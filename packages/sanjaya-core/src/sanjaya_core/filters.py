"""Filter condition and group models with in-memory evaluation."""

from __future__ import annotations

import operator as op
from typing import Any

from pydantic import BaseModel, model_validator

from sanjaya_core.enums import FilterCombinator, FilterOperator


def _accept_not_alias(data: Any) -> Any:
    """Pre-validator: accept ``"not"`` as an alias for ``negate``."""
    if isinstance(data, dict) and "not" in data and "negate" not in data:
        data["negate"] = data.pop("not")
    return data


def _negate_to_not(data: dict[str, Any], *, by_alias: bool) -> dict[str, Any]:
    """Post-dump helper: rename ``negate`` → ``not`` when *by_alias* is set.

    Recurses into ``conditions`` and ``groups`` so nested models get the
    rename as well (Pydantic's built-in serializer doesn't call custom
    ``model_dump`` on nested models).
    """
    if not by_alias:
        return data
    if "negate" in data:
        data["not"] = data.pop("negate")
    for cond in data.get("conditions", []):
        if isinstance(cond, dict) and "negate" in cond:
            cond["not"] = cond.pop("negate")
    for grp in data.get("groups", []):
        if isinstance(grp, dict):
            _negate_to_not(grp, by_alias=True)
    return data


class FilterCondition(BaseModel):
    """A single predicate: ``column <operator> value``."""

    column: str
    operator: FilterOperator
    value: Any = None
    negate: bool = False

    @model_validator(mode="before")
    @classmethod
    def _not_alias(cls, data: Any) -> Any:
        return _accept_not_alias(data)

    def model_dump(self, *, by_alias: bool | None = None, **kwargs: Any) -> dict[str, Any]:
        data = super().model_dump(by_alias=by_alias, **kwargs)
        return _negate_to_not(data, by_alias=bool(by_alias))

    # ------------------------------------------------------------------
    # In-memory evaluation (used by MockDataProvider, tests, etc.)
    # ------------------------------------------------------------------

    def evaluate(self, row: dict[str, Any]) -> bool:
        """Return *True* if *row* satisfies this condition."""
        cell = row.get(self.column)
        result = self._match(cell)
        return (not result) if self.negate else result

    def _match(self, cell: Any) -> bool:  # noqa: C901 — operator dispatch
        v = self.value
        match self.operator:
            case FilterOperator.EQ:
                return cell == v
            case FilterOperator.NEQ:
                return cell != v
            case FilterOperator.GT:
                return _safe_cmp(cell, v, op.gt)
            case FilterOperator.LT:
                return _safe_cmp(cell, v, op.lt)
            case FilterOperator.GTE:
                return _safe_cmp(cell, v, op.ge)
            case FilterOperator.LTE:
                return _safe_cmp(cell, v, op.le)
            case FilterOperator.CONTAINS:
                return v is not None and cell is not None and str(v) in str(cell)
            case FilterOperator.STARTSWITH:
                return (
                    v is not None
                    and cell is not None
                    and str(cell).startswith(str(v))
                )
            case FilterOperator.ENDSWITH:
                return (
                    v is not None
                    and cell is not None
                    and str(cell).endswith(str(v))
                )
            case FilterOperator.IS_NULL:
                return cell is None
            case FilterOperator.IS_NOT_NULL:
                return cell is not None
            case FilterOperator.BETWEEN:
                if not isinstance(v, (list, tuple)) or len(v) != 2:
                    return False
                lo, hi = v
                return (
                    cell is not None
                    and _safe_cmp(cell, lo, op.ge)
                    and _safe_cmp(cell, hi, op.le)
                )
            case FilterOperator.IN:
                if not isinstance(v, (list, tuple, set, frozenset)):
                    return False
                return cell in v
            case _:
                return False


class FilterGroup(BaseModel):
    """A recursive boolean group of :class:`FilterCondition` predicates."""

    combinator: FilterCombinator = FilterCombinator.AND
    negate: bool = False
    conditions: list[FilterCondition] = []
    groups: list[FilterGroup] = []

    @model_validator(mode="before")
    @classmethod
    def _not_alias(cls, data: Any) -> Any:
        return _accept_not_alias(data)

    def model_dump(self, *, by_alias: bool | None = None, **kwargs: Any) -> dict[str, Any]:
        data = super().model_dump(by_alias=by_alias, **kwargs)
        return _negate_to_not(data, by_alias=bool(by_alias))

    def evaluate(self, row: dict[str, Any]) -> bool:
        """Return *True* if *row* satisfies this group."""
        parts: list[bool] = [c.evaluate(row) for c in self.conditions]
        parts.extend(g.evaluate(row) for g in self.groups)

        if not parts:
            # Empty group matches everything.
            result = True
        elif self.combinator == FilterCombinator.AND:
            result = all(parts)
        else:
            result = any(parts)

        return (not result) if self.negate else result


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _safe_cmp(a: Any, b: Any, cmp: Any) -> bool:
    """Compare *a* and *b*, returning ``False`` on type errors or ``None``."""
    if a is None or b is None:
        return False
    try:
        return cmp(a, b)
    except TypeError:
        return False

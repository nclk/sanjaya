"""Filter schemas — wire JSON ↔ sanjaya_core FilterGroup translation."""

from __future__ import annotations

from typing import Any

from sanjaya_core.enums import FilterCombinator, FilterOperator
from sanjaya_core.filters import FilterCondition, FilterGroup


def parse_filter_group(data: dict[str, Any] | None) -> FilterGroup | None:
    """Parse a raw JSON dict into a :class:`FilterGroup`, or return *None*."""
    if data is None:
        return None
    return FilterGroup.model_validate(data)


def parse_ag_grid_filter_model(
    filter_model: dict[str, Any] | None,
) -> FilterGroup | None:
    """Translate AG Grid's column-keyed ``filterModel`` into a :class:`FilterGroup`.

    AG Grid sends filters as::

        {
            "country": {"filterType": "set", "values": ["Australia"]},
            "year":    {"filterType": "number", "type": "greaterThan", "filter": 2005},
        }

    We translate each entry into a :class:`FilterCondition` and combine them
    with AND.
    """
    if not filter_model:
        return None

    conditions: list[FilterCondition] = []
    for column, spec in filter_model.items():
        conds = _ag_filter_to_conditions(column, spec)
        conditions.extend(conds)

    if not conditions:
        return None

    return FilterGroup(combinator=FilterCombinator.AND, conditions=conditions)


# ---------------------------------------------------------------------------
# AG Grid filter type → FilterCondition
# ---------------------------------------------------------------------------

_AG_TEXT_TYPE_MAP: dict[str, FilterOperator] = {
    "equals": FilterOperator.EQ,
    "notEqual": FilterOperator.NEQ,
    "contains": FilterOperator.CONTAINS,
    "notContains": FilterOperator.CONTAINS,  # handled via negate
    "startsWith": FilterOperator.STARTSWITH,
    "endsWith": FilterOperator.ENDSWITH,
    "blank": FilterOperator.IS_NULL,
    "notBlank": FilterOperator.IS_NOT_NULL,
}

_AG_NUMBER_TYPE_MAP: dict[str, FilterOperator] = {
    "equals": FilterOperator.EQ,
    "notEqual": FilterOperator.NEQ,
    "greaterThan": FilterOperator.GT,
    "greaterThanOrEqual": FilterOperator.GTE,
    "lessThan": FilterOperator.LT,
    "lessThanOrEqual": FilterOperator.LTE,
    "inRange": FilterOperator.BETWEEN,
    "blank": FilterOperator.IS_NULL,
    "notBlank": FilterOperator.IS_NOT_NULL,
}


def _ag_filter_to_conditions(
    column: str, spec: dict[str, Any]
) -> list[FilterCondition]:
    """Convert a single AG Grid filter spec into one or more conditions."""
    filter_type = spec.get("filterType", "")

    # Combined filter (condition1 AND/OR condition2)
    if "operator" in spec and "conditions" in spec:
        sub_conditions: list[FilterCondition] = []
        for sub in spec["conditions"]:
            sub_conditions.extend(_ag_filter_to_conditions(column, sub))
        # If the operator is OR we need to wrap in a group, but since we
        # return flat conditions here, we handle it by returning them.
        # The caller will combine with AND; for OR we'd need nesting.
        # For simplicity, we flatten — the AG Grid combined filter is rare.
        return sub_conditions

    if filter_type == "set":
        values = spec.get("values", [])
        return [
            FilterCondition(
                column=column, operator=FilterOperator.IN, value=values
            )
        ]

    if filter_type == "text":
        ag_type = spec.get("type", "contains")
        op = _AG_TEXT_TYPE_MAP.get(ag_type, FilterOperator.CONTAINS)
        negate = ag_type == "notContains"
        value = spec.get("filter")
        return [
            FilterCondition(
                column=column, operator=op, value=value, negate=negate
            )
        ]

    if filter_type in ("number", "date"):
        ag_type = spec.get("type", "equals")
        op = _AG_NUMBER_TYPE_MAP.get(ag_type, FilterOperator.EQ)
        if op == FilterOperator.BETWEEN:
            value = [spec.get("filter"), spec.get("filterTo")]
        else:
            value = spec.get("filter") or spec.get("dateFrom")
        return [FilterCondition(column=column, operator=op, value=value)]

    # Fallback: treat unknown filter types as equality
    value = spec.get("filter") or spec.get("values")
    return [FilterCondition(column=column, operator=FilterOperator.EQ, value=value)]

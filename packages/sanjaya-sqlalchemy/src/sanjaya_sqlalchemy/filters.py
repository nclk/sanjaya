"""Compile :class:`~sanjaya_core.filters.FilterGroup` trees into SQLAlchemy
``WHERE`` clause expressions.

The compiler walks the recursive filter model from *sanjaya-core* and
produces a :class:`sqlalchemy.sql.expression.ColumnElement[bool]` that can be
appended to any ``SELECT`` statement via ``.where()``.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy.sql.expression import ColumnElement

from sanjaya_core.enums import FilterCombinator, FilterOperator
from sanjaya_core.filters import FilterCondition, FilterGroup


def compile_filter_group(
    fg: FilterGroup,
    column_lookup: dict[str, ColumnElement[Any]],
) -> ColumnElement[bool]:
    """Translate a :class:`FilterGroup` into a SQLAlchemy boolean expression.

    Parameters
    ----------
    fg:
        The recursive filter tree to compile.
    column_lookup:
        Mapping of column *name* → SQLAlchemy :class:`Column`.  The compiler
        looks up each :attr:`FilterCondition.column` here.

    Returns
    -------
    A composable SQLAlchemy expression suitable for ``stmt.where(expr)``.

    Raises
    ------
    KeyError
        If a condition references a column not present in *column_lookup*.
    """
    parts: list[ColumnElement[bool]] = []

    for cond in fg.conditions:
        parts.append(_compile_condition(cond, column_lookup))

    for sub in fg.groups:
        parts.append(compile_filter_group(sub, column_lookup))

    if not parts:
        expr: ColumnElement[bool] = sa.literal(True)
    elif fg.combinator == FilterCombinator.AND:
        expr = sa.and_(*parts)
    else:
        expr = sa.or_(*parts)

    if fg.negate:
        expr = sa.not_(expr)

    return expr


def _compile_condition(
    cond: FilterCondition,
    column_lookup: dict[str, ColumnElement[Any]],
) -> ColumnElement[bool]:
    """Compile a single :class:`FilterCondition` to a SQLAlchemy expression."""
    col = column_lookup[cond.column]
    v = cond.value

    expr: ColumnElement[bool]

    match cond.operator:
        case FilterOperator.EQ:
            expr = col == v
        case FilterOperator.NEQ:
            expr = col != v
        case FilterOperator.GT:
            expr = col > v
        case FilterOperator.LT:
            expr = col < v
        case FilterOperator.GTE:
            expr = col >= v
        case FilterOperator.LTE:
            expr = col <= v
        case FilterOperator.CONTAINS:
            expr = col.contains(str(v), autoescape=True)
        case FilterOperator.STARTSWITH:
            expr = col.startswith(str(v), autoescape=True)
        case FilterOperator.ENDSWITH:
            expr = col.endswith(str(v), autoescape=True)
        case FilterOperator.IS_NULL:
            expr = col.is_(None)
        case FilterOperator.IS_NOT_NULL:
            expr = col.isnot(None)
        case FilterOperator.BETWEEN:
            lo, hi = v[0], v[1]
            expr = col.between(lo, hi)
        case FilterOperator.IN:
            expr = col.in_(list(v))
        case _:
            # Unknown operator — match everything (safe fallback).
            expr = sa.literal(True)

    if cond.negate:
        expr = sa.not_(expr)

    return expr

"""Tests for the SQLAlchemy filter compiler."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Engine

from sanjaya_core.enums import FilterCombinator, FilterOperator
from sanjaya_core.filters import FilterCondition, FilterGroup

from sanjaya_sqlalchemy.filters import compile_filter_group


class TestFilterCompiler:
    """Compile filter trees and verify by actually running SQL."""

    def test_eq(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="desk", operator=FilterOperator.EQ, value="FX"),
        ])
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        assert len(rows) == 4
        assert all(r._mapping["desk"] == "FX" for r in rows)

    def test_neq(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="desk", operator=FilterOperator.NEQ, value="FX"),
        ])
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        assert len(rows) == 3

    def test_gt_lt(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="amount", operator=FilterOperator.GT, value=1500),
            FilterCondition(column="amount", operator=FilterOperator.LT, value=5000),
        ])
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        # amount > 1500 AND < 5000 → 2000, 3000, 4000 = 3 rows
        assert len(rows) == 3

    def test_between(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="amount", operator=FilterOperator.BETWEEN, value=[1000, 3000]),
        ])
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        # 1000, 2000, 1500, 3000 = 4 rows
        assert len(rows) == 4

    def test_in(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="region", operator=FilterOperator.IN, value=["US", "EU"]),
        ])
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        assert len(rows) == 5

    def test_contains(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="instrument", operator=FilterOperator.CONTAINS, value="USD"),
        ])
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        # EURUSD (×2), GBPUSD, USDJPY = 4
        assert len(rows) == 4

    def test_startswith(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="instrument", operator=FilterOperator.STARTSWITH, value="EUR"),
        ])
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        assert len(rows) == 2

    def test_or_combinator(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(
            combinator=FilterCombinator.OR,
            conditions=[
                FilterCondition(column="desk", operator=FilterOperator.EQ, value="FX"),
                FilterCondition(column="region", operator=FilterOperator.EQ, value="APAC"),
            ],
        )
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        # FX: 1,2,3,7; APAC: 6,7 → union = 1,2,3,6,7 = 5
        assert len(rows) == 5

    def test_negate_condition(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="desk", operator=FilterOperator.EQ, value="FX", negate=True),
        ])
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        assert len(rows) == 3  # NOT FX → Rates rows

    def test_negate_group(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup(
            negate=True,
            conditions=[
                FilterCondition(column="desk", operator=FilterOperator.EQ, value="FX"),
            ],
        )
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        assert len(rows) == 3

    def test_nested_groups(self, engine: Engine, trades_table: sa.Table) -> None:
        """(desk = 'FX') AND (region = 'US' OR region = 'EU')."""
        fg = FilterGroup(
            conditions=[
                FilterCondition(column="desk", operator=FilterOperator.EQ, value="FX"),
            ],
            groups=[
                FilterGroup(
                    combinator=FilterCombinator.OR,
                    conditions=[
                        FilterCondition(column="region", operator=FilterOperator.EQ, value="US"),
                        FilterCondition(column="region", operator=FilterOperator.EQ, value="EU"),
                    ],
                ),
            ],
        )
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        # FX + (US or EU) → ids 1, 2, 3
        assert len(rows) == 3

    def test_empty_group_matches_all(self, engine: Engine, trades_table: sa.Table) -> None:
        fg = FilterGroup()
        expr = compile_filter_group(fg, {c.name: c for c in trades_table.columns})
        stmt = sa.select(trades_table).where(expr)
        with engine.connect() as conn:
            rows = conn.execute(stmt).fetchall()
        assert len(rows) == 7

"""Tests for SQLAlchemyProvider — flat queries, aggregation, and pivot."""

from __future__ import annotations

from sanjaya_core.enums import AggFunc, FilterOperator, SortDirection
from sanjaya_core.filters import FilterCondition, FilterGroup
from sanjaya_core.types import SortSpec, ValueSpec

from sanjaya_sqlalchemy import SQLAlchemyProvider


# ---------------------------------------------------------------------------
# Flat query
# ---------------------------------------------------------------------------


class TestQuery:
    def test_select_all(self, provider: SQLAlchemyProvider) -> None:
        result = provider.query(["id", "desk", "amount"])
        assert result.total == 7
        assert len(result.rows) == 7
        assert result.columns == ["id", "desk", "amount"]
        # Every row should have exactly the requested keys.
        for row in result.rows:
            assert set(row.keys()) == {"id", "desk", "amount"}

    def test_limit_offset(self, provider: SQLAlchemyProvider) -> None:
        r1 = provider.query(["id"], sort=[SortSpec(column="id")], limit=3, offset=0)
        r2 = provider.query(["id"], sort=[SortSpec(column="id")], limit=3, offset=3)
        assert r1.total == 7
        ids_1 = [r["id"] for r in r1.rows]
        ids_2 = [r["id"] for r in r2.rows]
        assert ids_1 == [1, 2, 3]
        assert ids_2 == [4, 5, 6]

    def test_filter(self, provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="desk", operator=FilterOperator.EQ, value="FX"),
        ])
        result = provider.query(["id", "desk"], filter_group=fg)
        assert result.total == 4
        assert all(r["desk"] == "FX" for r in result.rows)

    def test_sort_asc(self, provider: SQLAlchemyProvider) -> None:
        result = provider.query(
            ["id", "amount"],
            sort=[SortSpec(column="amount", direction=SortDirection.ASC)],
        )
        amounts = [r["amount"] for r in result.rows]
        assert amounts == sorted(amounts)

    def test_sort_desc(self, provider: SQLAlchemyProvider) -> None:
        result = provider.query(
            ["id", "amount"],
            sort=[SortSpec(column="amount", direction=SortDirection.DESC)],
        )
        amounts = [r["amount"] for r in result.rows]
        assert amounts == sorted(amounts, reverse=True)

    def test_empty_result(self, provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="desk", operator=FilterOperator.EQ, value="Nonexistent"),
        ])
        result = provider.query(["id"], filter_group=fg)
        assert result.total == 0
        assert result.rows == []


# ---------------------------------------------------------------------------
# Simple aggregation (no pivot)
# ---------------------------------------------------------------------------


class TestSimpleAggregate:
    def test_group_by_single_column(self, provider: SQLAlchemyProvider) -> None:
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 2  # FX, Rates
        sums = {r["desk"]: r["sum_amount"] for r in result.rows}
        assert sums["FX"] == 1000 + 2000 + 1500 + 500  # 5000
        assert sums["Rates"] == 5000 + 3000 + 4000  # 12000

    def test_group_by_multiple_columns(self, provider: SQLAlchemyProvider) -> None:
        result = provider.aggregate(
            group_by_rows=["desk", "region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        # FX-US, FX-EU, FX-APAC, Rates-US, Rates-EU, Rates-APAC
        assert result.total == 6

    def test_multiple_agg_funcs(self, provider: SQLAlchemyProvider) -> None:
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=[],
            values=[
                ValueSpec(column="amount", agg=AggFunc.SUM),
                ValueSpec(column="amount", agg=AggFunc.COUNT),
            ],
        )
        fx_row = next(r for r in result.rows if r["desk"] == "FX")
        assert fx_row["sum_amount"] == 5000.0
        assert fx_row["count_amount"] == 4  # 4 FX trades

    def test_aggregate_with_filter(self, provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="region", operator=FilterOperator.EQ, value="US"),
        ])
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            filter_group=fg,
        )
        assert result.total == 2
        sums = {r["desk"]: r["sum_amount"] for r in result.rows}
        assert sums["FX"] == 3000.0
        assert sums["Rates"] == 5000.0

    def test_aggregate_with_limit_offset(self, provider: SQLAlchemyProvider) -> None:
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            sort=[SortSpec(column="desk")],
            limit=1,
            offset=0,
        )
        assert result.total == 2
        assert len(result.rows) == 1
        assert result.rows[0]["desk"] == "FX"

    def test_distinct_count(self, provider: SQLAlchemyProvider) -> None:
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=[],
            values=[ValueSpec(column="region", agg=AggFunc.DISTINCT_COUNT)],
        )
        dc = {r["desk"]: r["distinctCount_region"] for r in result.rows}
        assert dc["FX"] == 3        # US, EU, APAC
        assert dc["Rates"] == 3     # US, EU, APAC


# ---------------------------------------------------------------------------
# Pivot aggregation
# ---------------------------------------------------------------------------


class TestPivotAggregate:
    def test_basic_pivot(self, provider: SQLAlchemyProvider) -> None:
        """Pivot by region: desk × region → sum(amount)."""
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=["region"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 2  # FX, Rates
        # There should be row-dim columns + one per (region × measure)
        col_keys = [c.key for c in result.columns]
        assert "desk" in col_keys
        # Verify a few pivot columns exist
        assert any("US_sum_amount" in k for k in col_keys)
        assert any("EU_sum_amount" in k for k in col_keys)

        fx_row = next(r for r in result.rows if r["desk"] == "FX")
        assert fx_row["US_sum_amount"] == 3000.0   # 1000 + 2000
        assert fx_row["EU_sum_amount"] == 1500.0
        assert fx_row["APAC_sum_amount"] == 500.0

    def test_pivot_column_keys_are_strings(self, provider: SQLAlchemyProvider) -> None:
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=["region"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        for col in result.columns:
            if col.pivot_keys:
                assert all(isinstance(k, str) for k in col.pivot_keys)

    def test_multi_dim_pivot(self, provider: SQLAlchemyProvider) -> None:
        """Pivot by (region, instrument)."""
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=["region", "instrument"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 2
        # Find the FX-US-EURUSD cell
        fx_row = next(r for r in result.rows if r["desk"] == "FX")
        assert fx_row.get("US_EURUSD_sum_amount") == 1000.0

    def test_pivot_with_multiple_measures(self, provider: SQLAlchemyProvider) -> None:
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=["region"],
            values=[
                ValueSpec(column="amount", agg=AggFunc.SUM),
                ValueSpec(column="quantity", agg=AggFunc.SUM),
            ],
        )
        fx_row = next(r for r in result.rows if r["desk"] == "FX")
        assert fx_row["US_sum_amount"] == 3000.0
        assert fx_row["US_sum_quantity"] == 30  # 10 + 20

    def test_pivot_with_filter(self, provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="desk", operator=FilterOperator.EQ, value="FX"),
        ])
        result = provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=["region"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            filter_group=fg,
        )
        assert result.total == 1
        assert result.rows[0]["desk"] == "FX"


# ---------------------------------------------------------------------------
# SelectBase selectable (select() as input)
# ---------------------------------------------------------------------------


class TestSelectBaseSelectable:
    """Tests using a provider constructed with a ``select()`` statement."""

    def test_query_returns_filtered_rows(self, select_provider: SQLAlchemyProvider) -> None:
        result = select_provider.query(["id", "desk", "amount"])
        assert result.total == 4  # only FX rows
        assert all(r["desk"] == "FX" for r in result.rows)

    def test_sort(self, select_provider: SQLAlchemyProvider) -> None:
        result = select_provider.query(
            ["id", "amount"],
            sort=[SortSpec(column="amount", direction=SortDirection.ASC)],
        )
        amounts = [r["amount"] for r in result.rows]
        assert amounts == sorted(amounts)

    def test_additional_filter(self, select_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="region", operator=FilterOperator.EQ, value="US"),
        ])
        result = select_provider.query(["id", "desk"], filter_group=fg)
        assert result.total == 2  # FX-US rows only
        assert all(r["desk"] == "FX" for r in result.rows)

    def test_simple_aggregate(self, select_provider: SQLAlchemyProvider) -> None:
        result = select_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        sums = {r["region"]: r["sum_amount"] for r in result.rows}
        assert sums["US"] == 3000.0   # 1000 + 2000
        assert sums["EU"] == 1500.0
        assert sums["APAC"] == 500.0

    def test_pivot_aggregate(self, select_provider: SQLAlchemyProvider) -> None:
        result = select_provider.aggregate(
            group_by_rows=["desk"],
            group_by_cols=["region"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 1  # only FX
        fx_row = result.rows[0]
        assert fx_row["desk"] == "FX"
        assert fx_row["US_sum_amount"] == 3000.0
        assert fx_row["EU_sum_amount"] == 1500.0
        assert fx_row["APAC_sum_amount"] == 500.0

    def test_get_columns(self, select_provider: SQLAlchemyProvider) -> None:
        cols = select_provider.get_columns()
        assert len(cols) == 6

    def test_identity(self, select_provider: SQLAlchemyProvider) -> None:
        assert select_provider.key == "fx_trades"
        assert select_provider.label == "FX Trades"


# ---------------------------------------------------------------------------
# Provider metadata
# ---------------------------------------------------------------------------


class TestProviderMeta:
    def test_get_columns(self, provider: SQLAlchemyProvider) -> None:
        cols = provider.get_columns()
        assert len(cols) == 6
        names = [c.name for c in cols]
        assert "id" in names
        assert "desk" in names

    def test_capabilities(self, provider: SQLAlchemyProvider) -> None:
        assert provider.capabilities.pivot is True

    def test_identity(self, provider: SQLAlchemyProvider) -> None:
        assert provider.key == "trades"
        assert provider.label == "Trades"

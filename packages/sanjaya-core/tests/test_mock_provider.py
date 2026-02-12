"""Tests for MockDataProvider — query, aggregation, and pivot."""

from __future__ import annotations

import pytest

from sanjaya_core.enums import AggFunc, FilterOperator, SortDirection
from sanjaya_core.filters import FilterCondition, FilterGroup
from sanjaya_core.mock import MockDataProvider
from sanjaya_core.types import SortSpec, ValueSpec


class TestQuery:
    def test_basic_select(self, provider: MockDataProvider):
        result = provider.query(["year", "region", "amount"])
        assert result.columns == ["year", "region", "amount"]
        assert result.total == 8
        assert len(result.rows) == 8
        assert set(result.rows[0].keys()) == {"year", "region", "amount"}

    def test_limit_offset(self, provider: MockDataProvider):
        result = provider.query(["year"], limit=3, offset=2)
        assert len(result.rows) == 3
        assert result.total == 8

    def test_filter(self, provider: MockDataProvider):
        fg = FilterGroup(
            conditions=[
                FilterCondition(
                    column="region", operator=FilterOperator.EQ, value="North"
                )
            ]
        )
        result = provider.query(["year", "region"], filter_group=fg)
        assert result.total == 4
        assert all(r["region"] == "North" for r in result.rows)

    def test_sort_asc(self, provider: MockDataProvider):
        result = provider.query(
            ["amount"],
            sort=[SortSpec(column="amount", direction=SortDirection.ASC)],
        )
        amounts = [r["amount"] for r in result.rows]
        assert amounts == sorted(amounts)

    def test_sort_desc(self, provider: MockDataProvider):
        result = provider.query(
            ["amount"],
            sort=[SortSpec(column="amount", direction=SortDirection.DESC)],
        )
        amounts = [r["amount"] for r in result.rows]
        assert amounts == sorted(amounts, reverse=True)

    def test_combined_filter_sort_page(self, provider: MockDataProvider):
        fg = FilterGroup(
            conditions=[
                FilterCondition(
                    column="year", operator=FilterOperator.EQ, value=2024
                )
            ]
        )
        result = provider.query(
            ["region", "amount"],
            filter_group=fg,
            sort=[SortSpec(column="amount", direction=SortDirection.DESC)],
            limit=2,
            offset=0,
        )
        assert result.total == 4
        assert len(result.rows) == 2
        assert result.rows[0]["amount"] >= result.rows[1]["amount"]

    def test_empty_result(self, provider: MockDataProvider):
        fg = FilterGroup(
            conditions=[
                FilterCondition(
                    column="year", operator=FilterOperator.EQ, value=9999
                )
            ]
        )
        result = provider.query(["year"], filter_group=fg)
        assert result.total == 0
        assert result.rows == []


class TestSimpleAggregate:
    def test_group_by_single_column(self, provider: MockDataProvider):
        result = provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 2
        by_region = {r["region"]: r for r in result.rows}
        # North: 100 + 200 + 120 + 220 = 640
        assert by_region["North"]["sum_amount"] == 640
        # South: 150 + 250 + 170 + 270 = 840
        assert by_region["South"]["sum_amount"] == 840

    def test_group_by_multiple_columns(self, provider: MockDataProvider):
        result = provider.aggregate(
            group_by_rows=["year", "region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 4

    def test_multiple_agg_funcs(self, provider: MockDataProvider):
        result = provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[
                ValueSpec(column="amount", agg=AggFunc.SUM),
                ValueSpec(column="amount", agg=AggFunc.AVG),
                ValueSpec(column="amount", agg=AggFunc.COUNT),
            ],
        )
        by_region = {r["region"]: r for r in result.rows}
        north = by_region["North"]
        assert north["sum_amount"] == 640
        assert north["avg_amount"] == 160.0
        assert north["count_amount"] == 4

    def test_aggregate_with_filter(self, provider: MockDataProvider):
        fg = FilterGroup(
            conditions=[
                FilterCondition(
                    column="year", operator=FilterOperator.EQ, value=2023
                )
            ]
        )
        result = provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            filter_group=fg,
        )
        assert result.total == 2
        by_region = {r["region"]: r for r in result.rows}
        assert by_region["North"]["sum_amount"] == 300  # 100 + 200
        assert by_region["South"]["sum_amount"] == 400  # 150 + 250

    def test_aggregate_with_limit_offset(self, provider: MockDataProvider):
        result = provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            sort=[SortSpec(column="region", direction=SortDirection.ASC)],
            limit=1,
            offset=0,
        )
        assert result.total == 2
        assert len(result.rows) == 1
        assert result.rows[0]["region"] == "North"


class TestPivotAggregate:
    def test_basic_pivot(self, provider: MockDataProvider):
        """Pivot region over product, summing amount."""
        result = provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["product"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        # Should have 2 rows (North, South).
        assert result.total == 2
        # Columns: region + (Gadget × sum_amount) + (Widget × sum_amount).
        pivot_cols = [c for c in result.columns if c.pivot_keys]
        assert len(pivot_cols) == 2  # Gadget, Widget

        by_region = {r["region"]: r for r in result.rows}
        north = by_region["North"]
        # North-Gadget: 200 + 220 = 420
        gadget_key = next(c.key for c in pivot_cols if "Gadget" in c.key)
        assert north[gadget_key] == 420

    def test_multi_dim_pivot(self, provider: MockDataProvider):
        """Pivot year × product over region."""
        result = provider.aggregate(
            group_by_rows=["year"],
            group_by_cols=["region", "product"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        # 2 years
        assert result.total == 2
        # 4 pivot combos: (North, Gadget), (North, Widget), (South, Gadget), (South, Widget)
        pivot_cols = [c for c in result.columns if c.pivot_keys]
        assert len(pivot_cols) == 4

    def test_pivot_with_multiple_measures(self, provider: MockDataProvider):
        result = provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["product"],
            values=[
                ValueSpec(column="amount", agg=AggFunc.SUM),
                ValueSpec(column="quantity", agg=AggFunc.SUM),
            ],
        )
        # 2 products × 2 measures = 4 pivot columns
        pivot_cols = [c for c in result.columns if c.pivot_keys]
        assert len(pivot_cols) == 4

    def test_pivot_column_keys_are_strings(self, provider: MockDataProvider):
        """Pivot keys should be stringified for AG Grid compatibility."""
        result = provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["year"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        for col in result.columns:
            for pk in col.pivot_keys:
                assert isinstance(pk, str)


class TestProviderMeta:
    def test_get_columns(self, provider: MockDataProvider):
        cols = provider.get_columns()
        assert len(cols) == 5
        names = {c.name for c in cols}
        assert names == {"year", "region", "product", "amount", "quantity"}

    def test_capabilities(self, provider: MockDataProvider):
        assert provider.capabilities.pivot is True

    def test_identity(self, provider: MockDataProvider):
        assert provider.key == "test_trades"
        assert provider.label == "Test Trades"

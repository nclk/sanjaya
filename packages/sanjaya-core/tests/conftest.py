"""Shared fixtures for sanjaya-core tests."""

from __future__ import annotations

import pytest

from sanjaya_core.enums import AggFunc, ColumnType, FilterOperator
from sanjaya_core.mock import MockDataProvider
from sanjaya_core.types import (
    ColumnMeta,
    ColumnPivotOptions,
    DatasetCapabilities,
    PivotAggOption,
)


@pytest.fixture()
def sample_columns() -> list[ColumnMeta]:
    """Column definitions for a small trade-activity-like dataset."""
    return [
        ColumnMeta(
            name="year",
            label="Year",
            type=ColumnType.NUMBER,
            operators=[FilterOperator.EQ, FilterOperator.IN],
        ),
        ColumnMeta(
            name="region",
            label="Region",
            type=ColumnType.STRING,
            operators=[
                FilterOperator.EQ,
                FilterOperator.NEQ,
                FilterOperator.IN,
                FilterOperator.CONTAINS,
            ],
            pivot=ColumnPivotOptions(role="dimension"),
        ),
        ColumnMeta(
            name="product",
            label="Product",
            type=ColumnType.STRING,
            operators=[FilterOperator.EQ, FilterOperator.IN],
            pivot=ColumnPivotOptions(role="dimension"),
        ),
        ColumnMeta(
            name="amount",
            label="Amount",
            type=ColumnType.NUMBER,
            operators=[
                FilterOperator.EQ,
                FilterOperator.GT,
                FilterOperator.LT,
                FilterOperator.BETWEEN,
            ],
            pivot=ColumnPivotOptions(
                role="measure",
                allowed_aggs=[
                    PivotAggOption(agg=AggFunc.SUM, label="Sum"),
                    PivotAggOption(agg=AggFunc.AVG, label="Average"),
                ],
            ),
        ),
        ColumnMeta(
            name="quantity",
            label="Quantity",
            type=ColumnType.NUMBER,
            operators=[FilterOperator.EQ, FilterOperator.GT, FilterOperator.LT],
            pivot=ColumnPivotOptions(
                role="measure",
                allowed_aggs=[
                    PivotAggOption(agg=AggFunc.SUM, label="Sum"),
                    PivotAggOption(agg=AggFunc.COUNT, label="Count"),
                ],
            ),
        ),
    ]


@pytest.fixture()
def sample_data() -> list[dict]:
    """Small dataset for testing queries and aggregation."""
    return [
        {"year": 2023, "region": "North", "product": "Widget", "amount": 100, "quantity": 10},
        {"year": 2023, "region": "North", "product": "Gadget", "amount": 200, "quantity": 5},
        {"year": 2023, "region": "South", "product": "Widget", "amount": 150, "quantity": 8},
        {"year": 2023, "region": "South", "product": "Gadget", "amount": 250, "quantity": 12},
        {"year": 2024, "region": "North", "product": "Widget", "amount": 120, "quantity": 11},
        {"year": 2024, "region": "North", "product": "Gadget", "amount": 220, "quantity": 6},
        {"year": 2024, "region": "South", "product": "Widget", "amount": 170, "quantity": 9},
        {"year": 2024, "region": "South", "product": "Gadget", "amount": 270, "quantity": 14},
    ]


@pytest.fixture()
def provider(sample_columns, sample_data) -> MockDataProvider:
    """A ready-to-use ``MockDataProvider``."""
    return MockDataProvider(
        key="test_trades",
        label="Test Trades",
        columns=sample_columns,
        data=sample_data,
        description="Fixture dataset for unit tests",
        capabilities=DatasetCapabilities(pivot=True),
    )

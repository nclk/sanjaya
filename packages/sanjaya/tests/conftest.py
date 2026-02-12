"""Shared fixtures for sanjaya Django app tests."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from ninja import NinjaAPI
from ninja.testing import TestClient

from sanjaya_core.enums import AggFunc, ColumnType, FilterOperator
from sanjaya_core.mock import MockDataProvider
from sanjaya_core.types import (
    ColumnMeta,
    ColumnPivotOptions,
    DatasetCapabilities,
    PivotAggOption,
)

from sanjaya.api import router
from sanjaya.registry import registry

User = get_user_model()


@pytest.fixture(autouse=True)
def _clean_registry():
    """Ensure each test starts with a clean provider registry."""
    registry.clear()
    yield
    registry.clear()


@pytest.fixture()
def mock_provider() -> MockDataProvider:
    """Create and register a mock provider."""
    columns = [
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
            operators=[FilterOperator.EQ, FilterOperator.IN],
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
            operators=[FilterOperator.EQ, FilterOperator.GT, FilterOperator.LT],
            pivot=ColumnPivotOptions(
                role="measure",
                allowed_aggs=[PivotAggOption(agg=AggFunc.SUM, label="Sum")],
            ),
        ),
    ]
    data = [
        {"year": 2023, "region": "North", "product": "Widget", "amount": 100},
        {"year": 2023, "region": "North", "product": "Gadget", "amount": 200},
        {"year": 2023, "region": "South", "product": "Widget", "amount": 150},
        {"year": 2024, "region": "North", "product": "Widget", "amount": 120},
        {"year": 2024, "region": "South", "product": "Gadget", "amount": 270},
    ]
    provider = MockDataProvider(
        key="test_trades",
        label="Test Trades",
        columns=columns,
        data=data,
        capabilities=DatasetCapabilities(pivot=True),
    )
    registry.add(provider)
    return provider


@pytest.fixture()
def user(db):
    """Create a basic authenticated user."""
    return User.objects.create_user(
        username="testuser", password="testpass", email="test@example.com"
    )


@pytest.fixture(scope="session")
def client():
    """Ninja TestClient wired to the reporting router via a NinjaAPI wrapper.

    Session-scoped because a Router can only be attached to one NinjaAPI
    instance.  The NinjaAPI is only used to build URL patterns — request
    state is per-call.
    """
    api = NinjaAPI()
    api.add_router("", router)
    return TestClient(api)

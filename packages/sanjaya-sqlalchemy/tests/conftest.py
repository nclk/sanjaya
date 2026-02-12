"""Shared fixtures for sanjaya-sqlalchemy tests.

Uses an in-memory SQLite database with a ``trades`` table pre-populated
with deterministic sample data.  The schema and data are designed to
exercise flat queries, simple aggregation, and pivot aggregation.
"""

from __future__ import annotations

import pytest
import sqlalchemy as sa

from sanjaya_core.enums import AggFunc, ColumnType
from sanjaya_core.types import (
    ColumnMeta,
    ColumnPivotOptions,
    DatasetCapabilities,
    PivotAggOption,
)

from sanjaya_sqlalchemy import SQLAlchemyProvider


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def engine() -> sa.engine.Engine:
    return sa.create_engine("sqlite:///:memory:")


@pytest.fixture(scope="session")
def trades_table(engine: sa.engine.Engine) -> sa.Table:
    metadata = sa.MetaData()
    table = sa.Table(
        "trades",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("desk", sa.String(50)),
        sa.Column("region", sa.String(50)),
        sa.Column("instrument", sa.String(50)),
        sa.Column("amount", sa.Float),
        sa.Column("quantity", sa.Integer),
    )
    metadata.create_all(engine)

    rows = [
        {"id": 1, "desk": "FX",    "region": "US",   "instrument": "EURUSD", "amount": 1000.0, "quantity": 10},
        {"id": 2, "desk": "FX",    "region": "US",   "instrument": "GBPUSD", "amount": 2000.0, "quantity": 20},
        {"id": 3, "desk": "FX",    "region": "EU",   "instrument": "EURUSD", "amount": 1500.0, "quantity": 15},
        {"id": 4, "desk": "Rates", "region": "US",   "instrument": "T-Note", "amount": 5000.0, "quantity": 50},
        {"id": 5, "desk": "Rates", "region": "EU",   "instrument": "Bund",   "amount": 3000.0, "quantity": 30},
        {"id": 6, "desk": "Rates", "region": "APAC", "instrument": "JGB",    "amount": 4000.0, "quantity": 40},
        {"id": 7, "desk": "FX",    "region": "APAC", "instrument": "USDJPY", "amount":  500.0, "quantity":  5},
    ]
    with engine.begin() as conn:
        conn.execute(table.insert(), rows)

    return table


COLUMN_DEFS = [
    ColumnMeta(name="id",         label="ID",         type=ColumnType.NUMBER),
    ColumnMeta(name="desk",       label="Desk",       type=ColumnType.STRING),
    ColumnMeta(name="region",     label="Region",     type=ColumnType.STRING),
    ColumnMeta(name="instrument", label="Instrument", type=ColumnType.STRING),
    ColumnMeta(
        name="amount",
        label="Amount",
        type=ColumnType.CURRENCY,
        pivot=ColumnPivotOptions(
            role="measure",
            allowed_aggs=[
                PivotAggOption(agg=AggFunc.SUM, label="Sum"),
                PivotAggOption(agg=AggFunc.AVG, label="Avg"),
            ],
        ),
    ),
    ColumnMeta(name="quantity",   label="Quantity",   type=ColumnType.NUMBER),
]


@pytest.fixture(scope="session")
def provider(
    engine: sa.engine.Engine,
    trades_table: sa.Table,
) -> SQLAlchemyProvider:
    return SQLAlchemyProvider(
        key="trades",
        label="Trades",
        engine=engine,
        selectable=trades_table,
        columns=COLUMN_DEFS,
        capabilities=DatasetCapabilities(pivot=True),
    )

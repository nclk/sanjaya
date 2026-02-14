"""Northwind order-details dataset — 4-table JOIN via SQLAlchemy Core.

This provider exercises multi-table JOINs, computed columns, label
aliasing, and the full range of pivot / filter / sort features.
"""

from __future__ import annotations

import os

import sqlalchemy as sa
from sqlalchemy.engine import Engine

from sanjaya_core.enums import (
    AggFunc,
    ColumnType,
    FilterOperator,
    FilterStyle,
    FormatHintKind,
)
from sanjaya_core.types import (
    ColumnMeta,
    ColumnPivotOptions,
    DatasetCapabilities,
    FormatHints,
    PivotAggOption,
)
from sanjaya_sqlalchemy import SQLAlchemyProvider

# ── MSSQL connection URL ──────────────────────────────────────────

MSSQL_URL = os.environ.get(
    "SANJAYA_MSSQL_URL",
    "mssql+pyodbc://sa:Sanjaya_Test1@localhost:1433/sanjaya_test"
    "?driver=ODBC+Driver+18+for+SQL+Server"
    "&TrustServerCertificate=yes&Encrypt=no",
)


def _create_engine() -> Engine:
    return sa.create_engine(MSSQL_URL, echo=False)


def _create_selectable(engine: Engine) -> sa.SelectBase:
    """Build the 4-table joined selectable.

    Returns a ``Select`` that the provider will wrap as a subquery.
    """
    meta = sa.MetaData()
    meta.reflect(bind=engine)

    customers = meta.tables["customers"]
    products_t = meta.tables["products"]
    orders = meta.tables["orders"]
    order_details = meta.tables["order_details"]

    return (
        sa.select(
            order_details.c.detail_id,
            order_details.c.order_id,
            orders.c.order_date,
            orders.c.ship_country,
            orders.c.freight,
            customers.c.company.label("customer"),
            customers.c.city.label("customer_city"),
            customers.c.country.label("customer_country"),
            products_t.c.name.label("product"),
            products_t.c.category,
            order_details.c.unit_price,
            order_details.c.quantity,
            order_details.c.discount,
            (
                order_details.c.unit_price
                * order_details.c.quantity
                * (1 - order_details.c.discount)
            ).label("line_total"),
        )
        .select_from(
            order_details.join(
                orders, order_details.c.order_id == orders.c.order_id
            )
            .join(customers, orders.c.customer_id == customers.c.customer_id)
            .join(
                products_t,
                order_details.c.product_id == products_t.c.product_id,
            )
        )
    )


# ── Column metadata ──────────────────────────────────────────────

MEASURE_AGGS = [
    PivotAggOption(agg=AggFunc.SUM, label="Sum"),
    PivotAggOption(agg=AggFunc.AVG, label="Average"),
    PivotAggOption(agg=AggFunc.MIN, label="Min"),
    PivotAggOption(agg=AggFunc.MAX, label="Max"),
    PivotAggOption(agg=AggFunc.COUNT, label="Count"),
]

COUNT_ONLY_AGGS = [
    PivotAggOption(agg=AggFunc.COUNT, label="Count"),
    PivotAggOption(agg=AggFunc.DISTINCT_COUNT, label="Distinct Count"),
]

COLUMNS: list[ColumnMeta] = [
    ColumnMeta(
        name="detail_id",
        label="Detail ID",
        type=ColumnType.NUMBER,
        operators=[FilterOperator.EQ, FilterOperator.NEQ],
    ),
    ColumnMeta(
        name="order_id",
        label="Order ID",
        type=ColumnType.NUMBER,
        operators=[FilterOperator.EQ, FilterOperator.NEQ, FilterOperator.IN],
        pivot=ColumnPivotOptions(
            role="measure",
            allowed_aggs=COUNT_ONLY_AGGS,
        ),
    ),
    ColumnMeta(
        name="order_date",
        label="Order Date",
        type=ColumnType.DATE,
        operators=[
            FilterOperator.EQ,
            FilterOperator.GT,
            FilterOperator.GTE,
            FilterOperator.LT,
            FilterOperator.LTE,
            FilterOperator.BETWEEN,
        ],
        pivot=ColumnPivotOptions(role="dimension"),
    ),
    ColumnMeta(
        name="ship_country",
        label="Ship Country",
        type=ColumnType.STRING,
        operators=[FilterOperator.EQ, FilterOperator.NEQ, FilterOperator.IN],
        filter_style=FilterStyle.SELECT,
        enum_values=[
            "Argentina", "Austria", "Belgium", "Brazil", "Canada",
            "Denmark", "Finland", "France", "Germany", "Ireland",
            "Italy", "Mexico", "Norway", "Poland", "Portugal",
            "Spain", "Sweden", "Switzerland", "UK", "USA", "Venezuela",
        ],
        pivot=ColumnPivotOptions(role="dimension"),
    ),
    ColumnMeta(
        name="freight",
        label="Freight",
        type=ColumnType.CURRENCY,
        operators=[
            FilterOperator.EQ,
            FilterOperator.GT,
            FilterOperator.LT,
            FilterOperator.BETWEEN,
        ],
        format_hints=FormatHints(
            kind=FormatHintKind.CURRENCY, decimals=2, currency_code="USD"
        ),
        pivot=ColumnPivotOptions(role="measure", allowed_aggs=MEASURE_AGGS),
    ),
    ColumnMeta(
        name="customer",
        label="Customer",
        type=ColumnType.STRING,
        operators=[
            FilterOperator.EQ,
            FilterOperator.NEQ,
            FilterOperator.CONTAINS,
            FilterOperator.IN,
        ],
        pivot=ColumnPivotOptions(role="dimension"),
    ),
    ColumnMeta(
        name="customer_city",
        label="Customer City",
        type=ColumnType.STRING,
        operators=[
            FilterOperator.EQ,
            FilterOperator.NEQ,
            FilterOperator.IN,
        ],
        pivot=ColumnPivotOptions(role="dimension"),
    ),
    ColumnMeta(
        name="customer_country",
        label="Customer Country",
        type=ColumnType.STRING,
        operators=[FilterOperator.EQ, FilterOperator.NEQ, FilterOperator.IN],
        filter_style=FilterStyle.SELECT,
        enum_values=[
            "Argentina", "Austria", "Belgium", "Brazil", "Canada",
            "Denmark", "Finland", "France", "Germany", "Ireland",
            "Italy", "Mexico", "Norway", "Poland", "Portugal",
            "Spain", "Sweden", "Switzerland", "UK", "USA", "Venezuela",
        ],
        pivot=ColumnPivotOptions(role="dimension"),
    ),
    ColumnMeta(
        name="product",
        label="Product",
        type=ColumnType.STRING,
        operators=[
            FilterOperator.EQ,
            FilterOperator.NEQ,
            FilterOperator.CONTAINS,
            FilterOperator.IN,
        ],
        pivot=ColumnPivotOptions(role="dimension"),
    ),
    ColumnMeta(
        name="category",
        label="Category",
        type=ColumnType.STRING,
        operators=[FilterOperator.EQ, FilterOperator.NEQ, FilterOperator.IN],
        filter_style=FilterStyle.SELECT,
        enum_values=[
            "Beverages", "Condiments", "Confections", "Dairy Products",
            "Grains/Cereals", "Meat/Poultry", "Produce", "Seafood",
        ],
        pivot=ColumnPivotOptions(role="dimension"),
    ),
    ColumnMeta(
        name="unit_price",
        label="Unit Price",
        type=ColumnType.CURRENCY,
        operators=[
            FilterOperator.EQ,
            FilterOperator.GT,
            FilterOperator.LT,
            FilterOperator.BETWEEN,
        ],
        format_hints=FormatHints(
            kind=FormatHintKind.CURRENCY, decimals=2, currency_code="USD"
        ),
        pivot=ColumnPivotOptions(role="measure", allowed_aggs=MEASURE_AGGS),
    ),
    ColumnMeta(
        name="quantity",
        label="Quantity",
        type=ColumnType.NUMBER,
        operators=[
            FilterOperator.EQ,
            FilterOperator.GT,
            FilterOperator.LT,
            FilterOperator.BETWEEN,
        ],
        format_hints=FormatHints(kind=FormatHintKind.INTEGER),
        pivot=ColumnPivotOptions(role="measure", allowed_aggs=MEASURE_AGGS),
    ),
    ColumnMeta(
        name="discount",
        label="Discount",
        type=ColumnType.PERCENTAGE,
        operators=[
            FilterOperator.EQ,
            FilterOperator.GT,
            FilterOperator.LT,
        ],
        format_hints=FormatHints(kind=FormatHintKind.PERCENTAGE, decimals=0),
        pivot=ColumnPivotOptions(role="measure", allowed_aggs=MEASURE_AGGS),
    ),
    ColumnMeta(
        name="line_total",
        label="Line Total",
        type=ColumnType.CURRENCY,
        operators=[
            FilterOperator.EQ,
            FilterOperator.GT,
            FilterOperator.LT,
            FilterOperator.BETWEEN,
        ],
        format_hints=FormatHints(
            kind=FormatHintKind.CURRENCY, decimals=2, currency_code="USD"
        ),
        pivot=ColumnPivotOptions(role="measure", allowed_aggs=MEASURE_AGGS),
    ),
]


# ── Provider factory ─────────────────────────────────────────────


def make_provider() -> SQLAlchemyProvider:
    """Create the Northwind order-details provider.

    Uses deferred engine + selectable so nothing touches the database
    until the first actual query.
    """
    return SQLAlchemyProvider(
        key="order_details",
        label="Order Details (Northwind)",
        description=(
            "Northwind order line items joined with orders, customers, "
            "and products.  ~2 000 rows across 4 tables."
        ),
        engine=_create_engine,
        selectable=_create_selectable,
        columns=COLUMNS,
        capabilities=DatasetCapabilities(pivot=True),
    )

"""Integration tests targeting a live PostgreSQL instance.

These tests are **skipped** unless the ``SANJAYA_POSTGRES_URL`` environment
variable is set to a valid SQLAlchemy connection URL, e.g.::

    export SANJAYA_POSTGRES_URL="postgresql+psycopg://postgres:pass@localhost:5432/sanjaya_test"

The test suite creates temporary tables, populates them with deterministic
data, builds providers from multi-table ``SelectBase`` joins, and verifies
correctness end-to-end against the real database.

Run with::

    SANJAYA_POSTGRES_URL="..." pytest packages/sanjaya-sqlalchemy/ -k postgres -v
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
import sqlalchemy as sa

from sanjaya_core.enums import AggFunc, ColumnType, FilterCombinator, FilterOperator, SortDirection
from sanjaya_core.filters import FilterCondition, FilterGroup
from sanjaya_core.types import (
    ColumnMeta,
    DatasetCapabilities,
    SortSpec,
    ValueSpec,
)

from sanjaya_sqlalchemy import SQLAlchemyProvider, columns_from_selectable

# ---------------------------------------------------------------------------
# Skip the entire module when no PostgreSQL connection is available.
# ---------------------------------------------------------------------------

POSTGRES_URL = os.environ.get("SANJAYA_POSTGRES_URL")

pytestmark = pytest.mark.skipif(
    POSTGRES_URL is None,
    reason="SANJAYA_POSTGRES_URL not set — skipping PostgreSQL integration tests",
)


# ---------------------------------------------------------------------------
# Fixtures — schema, data, providers
# ---------------------------------------------------------------------------

# Unique suffix so parallel CI runs don't collide on the same database.
_SUFFIX = uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def pg_engine() -> sa.engine.Engine:
    assert POSTGRES_URL is not None
    return sa.create_engine(POSTGRES_URL)


@pytest.fixture(scope="module")
def pg_tables(pg_engine: sa.engine.Engine) -> Generator[dict[str, sa.Table]]:
    """Create three related tables and populate them with sample data.

    Schema::

        customers ──┐
                     ├──→ orders ←──┐
        products  ───┘              │
                                    │
        (joined via SelectBase)  ───┘

    All table names are suffixed with a UUID fragment to avoid collisions
    in shared databases.
    """
    metadata = sa.MetaData()

    customers = sa.Table(
        f"sj_customers_{_SUFFIX}",
        metadata,
        sa.Column("customer_id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("region", sa.String(50), nullable=False),
    )

    products = sa.Table(
        f"sj_products_{_SUFFIX}",
        metadata,
        sa.Column("product_id", sa.Integer, primary_key=True),
        sa.Column("product_name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
    )

    orders = sa.Table(
        f"sj_orders_{_SUFFIX}",
        metadata,
        sa.Column("order_id", sa.Integer, primary_key=True),
        sa.Column("customer_id", sa.Integer, nullable=False),
        sa.Column("product_id", sa.Integer, nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("note", sa.String(200), nullable=True),
    )

    metadata.create_all(pg_engine)

    customer_rows = [
        {"customer_id": 1, "name": "Acme Corp", "region": "US"},
        {"customer_id": 2, "name": "Globex", "region": "EU"},
        {"customer_id": 3, "name": "Initech", "region": "US"},
        {"customer_id": 4, "name": "Umbrella", "region": "APAC"},
    ]

    product_rows = [
        {"product_id": 1, "product_name": "Widget", "category": "Hardware"},
        {"product_id": 2, "product_name": "Gadget", "category": "Hardware"},
        {"product_id": 3, "product_name": "Service Plan", "category": "Services"},
    ]

    order_rows = [
        {"order_id": 1, "customer_id": 1, "product_id": 1, "amount": 1000, "quantity": 10, "note": None},
        {"order_id": 2, "customer_id": 1, "product_id": 2, "amount": 2000, "quantity": 20, "note": "rush"},
        {"order_id": 3, "customer_id": 2, "product_id": 1, "amount": 1500, "quantity": 15, "note": None},
        {"order_id": 4, "customer_id": 2, "product_id": 3, "amount": 3000, "quantity": 5, "note": "annual"},
        {"order_id": 5, "customer_id": 3, "product_id": 1, "amount": 500, "quantity": 5, "note": None},
        {"order_id": 6, "customer_id": 3, "product_id": 2, "amount": 4000, "quantity": 40, "note": None},
        {"order_id": 7, "customer_id": 4, "product_id": 3, "amount": 6000, "quantity": 12, "note": "multi-year"},
        {"order_id": 8, "customer_id": 4, "product_id": 1, "amount": 800, "quantity": 8, "note": None},
    ]

    with pg_engine.begin() as conn:
        conn.execute(customers.insert(), customer_rows)
        conn.execute(products.insert(), product_rows)
        conn.execute(orders.insert(), order_rows)

    yield {"customers": customers, "products": products, "orders": orders}

    # Teardown: drop tables.
    metadata.drop_all(pg_engine)


@pytest.fixture(scope="module")
def joined_selectable(pg_tables: dict[str, sa.Table]) -> sa.SelectBase:
    """A three-table join returned as a ``SelectBase``.

    The subquery columns are ``ColumnClause`` objects, not schema-bound
    ``Column`` objects.
    """
    orders = pg_tables["orders"]
    customers = pg_tables["customers"]
    products = pg_tables["products"]

    return (
        sa.select(
            orders.c.order_id,
            customers.c.name.label("customer"),
            customers.c.region,
            products.c.product_name.label("product"),
            products.c.category,
            orders.c.amount,
            orders.c.quantity,
            orders.c.note,
        )
        .select_from(
            orders
            .join(customers, orders.c.customer_id == customers.c.customer_id)
            .join(products, orders.c.product_id == products.c.product_id)
        )
    )


JOIN_COLUMN_DEFS = [
    ColumnMeta(name="order_id", label="Order ID", type=ColumnType.NUMBER),
    ColumnMeta(name="customer", label="Customer", type=ColumnType.STRING),
    ColumnMeta(name="region", label="Region", type=ColumnType.STRING),
    ColumnMeta(name="product", label="Product", type=ColumnType.STRING),
    ColumnMeta(name="category", label="Category", type=ColumnType.STRING),
    ColumnMeta(name="amount", label="Amount", type=ColumnType.CURRENCY),
    ColumnMeta(name="quantity", label="Quantity", type=ColumnType.NUMBER),
    ColumnMeta(name="note", label="Note", type=ColumnType.STRING, nullable=True),
]


@pytest.fixture(scope="module")
def pg_provider(
    pg_engine: sa.engine.Engine,
    joined_selectable: sa.SelectBase,
) -> SQLAlchemyProvider:
    """Provider over a joined SelectBase with explicit column defs."""
    return SQLAlchemyProvider(
        key="pg_orders",
        label="PG Orders",
        engine=pg_engine,
        selectable=joined_selectable,
        columns=JOIN_COLUMN_DEFS,
        capabilities=DatasetCapabilities(pivot=True),
    )


@pytest.fixture(scope="module")
def pg_inferred_provider(
    pg_engine: sa.engine.Engine,
    joined_selectable: sa.SelectBase,
) -> SQLAlchemyProvider:
    """Provider over a joined SelectBase with auto-inferred columns."""
    return SQLAlchemyProvider(
        key="pg_orders_inferred",
        label="PG Orders (Inferred)",
        engine=pg_engine,
        selectable=joined_selectable,
        capabilities=DatasetCapabilities(pivot=True),
    )


# ---------------------------------------------------------------------------
# Column inference from joined SelectBase
# ---------------------------------------------------------------------------

class TestPostgresColumnInference:
    """Auto-inferred columns from a multi-table join SelectBase."""

    def test_inferred_columns_match_expected(
        self, pg_inferred_provider: SQLAlchemyProvider,
    ) -> None:
        cols = pg_inferred_provider.get_columns()
        names = [c.name for c in cols]
        assert "order_id" in names
        assert "customer" in names
        assert "region" in names
        assert "product" in names
        assert "category" in names
        assert "amount" in names
        assert "quantity" in names
        assert "note" in names

    def test_columns_from_subqueried_join(
        self,
        joined_selectable: sa.SelectBase,
    ) -> None:
        """``columns_from_selectable`` must not crash on ColumnClause."""
        sub = joined_selectable.subquery()
        cols = columns_from_selectable(sub)
        assert len(cols) == 8
        by_name = {c.name: c for c in cols}
        assert by_name["amount"].type == ColumnType.NUMBER
        assert by_name["customer"].type == ColumnType.STRING


# ---------------------------------------------------------------------------
# Flat queries
# ---------------------------------------------------------------------------

class TestPostgresQuery:
    def test_select_all(self, pg_provider: SQLAlchemyProvider) -> None:
        result = pg_provider.query(
            ["order_id", "customer", "region", "amount"],
        )
        assert result.total == 8
        assert len(result.rows) == 8

    def test_limit_offset_no_sort(self, pg_provider: SQLAlchemyProvider) -> None:
        """PostgreSQL handles OFFSET without ORDER BY, but verify correctness."""
        r1 = pg_provider.query(
            ["order_id", "customer"], limit=3, offset=0,
        )
        r2 = pg_provider.query(
            ["order_id", "customer"], limit=3, offset=3,
        )
        assert r1.total == 8
        assert len(r1.rows) == 3
        assert len(r2.rows) == 3
        ids_1 = {r["order_id"] for r in r1.rows}
        ids_2 = {r["order_id"] for r in r2.rows}
        assert ids_1.isdisjoint(ids_2)

    def test_limit_offset_with_sort(self, pg_provider: SQLAlchemyProvider) -> None:
        r1 = pg_provider.query(
            ["order_id"],
            sort=[SortSpec(column="order_id", direction=SortDirection.ASC)],
            limit=4,
            offset=0,
        )
        r2 = pg_provider.query(
            ["order_id"],
            sort=[SortSpec(column="order_id", direction=SortDirection.ASC)],
            limit=4,
            offset=4,
        )
        ids_1 = [r["order_id"] for r in r1.rows]
        ids_2 = [r["order_id"] for r in r2.rows]
        assert ids_1 == [1, 2, 3, 4]
        assert ids_2 == [5, 6, 7, 8]

    def test_filter(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="region", operator=FilterOperator.EQ, value="US"),
        ])
        result = pg_provider.query(["order_id", "customer"], filter_group=fg)
        assert result.total == 4  # Acme (2) + Initech (2)

    def test_filter_is_null(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="note", operator=FilterOperator.IS_NULL),
        ])
        result = pg_provider.query(["order_id", "note"], filter_group=fg)
        assert result.total == 5

    def test_filter_is_not_null(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="note", operator=FilterOperator.IS_NOT_NULL),
        ])
        result = pg_provider.query(["order_id", "note"], filter_group=fg)
        assert result.total == 3
        assert all(r["note"] is not None for r in result.rows)

    def test_filter_contains(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="customer", operator=FilterOperator.CONTAINS, value="Corp",
            ),
        ])
        result = pg_provider.query(["order_id", "customer"], filter_group=fg)
        assert result.total == 2
        assert all("Corp" in r["customer"] for r in result.rows)

    def test_sort_desc(self, pg_provider: SQLAlchemyProvider) -> None:
        result = pg_provider.query(
            ["order_id", "amount"],
            sort=[SortSpec(column="amount", direction=SortDirection.DESC)],
        )
        amounts = [r["amount"] for r in result.rows]
        assert amounts == sorted(amounts, reverse=True)

    def test_empty_result(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="region", operator=FilterOperator.EQ, value="NOWHERE",
            ),
        ])
        result = pg_provider.query(["order_id"], filter_group=fg)
        assert result.total == 0
        assert result.rows == []

    def test_filter_neq(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="region", operator=FilterOperator.NEQ, value="US"),
        ])
        result = pg_provider.query(["order_id", "region"], filter_group=fg)
        assert result.total == 4  # EU (2) + APAC (2)
        assert all(r["region"] != "US" for r in result.rows)

    def test_filter_gt_lt(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="amount", operator=FilterOperator.GT, value=1000),
            FilterCondition(column="amount", operator=FilterOperator.LT, value=4000),
        ])
        result = pg_provider.query(["order_id", "amount"], filter_group=fg)
        # amount > 1000 AND < 4000 → 1500, 2000, 3000 = 3 rows
        assert result.total == 3
        assert all(1000 < r["amount"] < 4000 for r in result.rows)

    def test_filter_gte_lte(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="amount", operator=FilterOperator.GTE, value=2000),
            FilterCondition(column="amount", operator=FilterOperator.LTE, value=4000),
        ])
        result = pg_provider.query(["order_id", "amount"], filter_group=fg)
        # 2000, 3000, 4000 = 3 rows
        assert result.total == 3
        assert all(2000 <= r["amount"] <= 4000 for r in result.rows)

    def test_filter_between(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="amount", operator=FilterOperator.BETWEEN, value=[1000, 3000],
            ),
        ])
        result = pg_provider.query(["order_id", "amount"], filter_group=fg)
        # 1000, 1500, 2000, 3000 = 4 rows
        assert result.total == 4
        assert all(1000 <= r["amount"] <= 3000 for r in result.rows)

    def test_filter_in(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="region", operator=FilterOperator.IN, value=["US", "EU"],
            ),
        ])
        result = pg_provider.query(["order_id", "region"], filter_group=fg)
        assert result.total == 6  # US (4) + EU (2)
        assert all(r["region"] in ("US", "EU") for r in result.rows)

    def test_filter_startswith(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="customer", operator=FilterOperator.STARTSWITH, value="Acme",
            ),
        ])
        result = pg_provider.query(["order_id", "customer"], filter_group=fg)
        assert result.total == 2
        assert all(r["customer"].startswith("Acme") for r in result.rows)

    def test_filter_endswith(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="customer", operator=FilterOperator.ENDSWITH, value="Corp",
            ),
        ])
        result = pg_provider.query(["order_id", "customer"], filter_group=fg)
        assert result.total == 2
        assert all(r["customer"].endswith("Corp") for r in result.rows)

    def test_filter_or_combinator(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(
            combinator=FilterCombinator.OR,
            conditions=[
                FilterCondition(column="region", operator=FilterOperator.EQ, value="APAC"),
                FilterCondition(column="customer", operator=FilterOperator.EQ, value="Globex"),
            ],
        )
        result = pg_provider.query(["order_id", "region", "customer"], filter_group=fg)
        # APAC: orders 7,8; Globex (EU): orders 3,4 → 4
        assert result.total == 4
        assert all(
            r["region"] == "APAC" or r["customer"] == "Globex"
            for r in result.rows
        )

    def test_filter_negate_condition(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="region", operator=FilterOperator.EQ, value="US", negate=True,
            ),
        ])
        result = pg_provider.query(["order_id", "region"], filter_group=fg)
        assert result.total == 4
        assert all(r["region"] != "US" for r in result.rows)

    def test_filter_negate_group(self, pg_provider: SQLAlchemyProvider) -> None:
        """NOT(region = 'US') — tests NOT handling."""
        fg = FilterGroup(
            negate=True,
            conditions=[
                FilterCondition(column="region", operator=FilterOperator.EQ, value="US"),
            ],
        )
        result = pg_provider.query(["order_id", "region"], filter_group=fg)
        assert result.total == 4
        assert all(r["region"] != "US" for r in result.rows)

    def test_filter_nested_groups(self, pg_provider: SQLAlchemyProvider) -> None:
        """(region = 'US') AND (category = 'Hardware' OR category = 'Services')."""
        fg = FilterGroup(
            conditions=[
                FilterCondition(column="region", operator=FilterOperator.EQ, value="US"),
            ],
            groups=[
                FilterGroup(
                    combinator=FilterCombinator.OR,
                    conditions=[
                        FilterCondition(column="category", operator=FilterOperator.EQ, value="Hardware"),
                        FilterCondition(column="category", operator=FilterOperator.EQ, value="Services"),
                    ],
                ),
            ],
        )
        result = pg_provider.query(["order_id", "region", "category"], filter_group=fg)
        assert result.total == 4  # All US orders are Hardware
        assert all(r["region"] == "US" for r in result.rows)

    def test_sort_asc(self, pg_provider: SQLAlchemyProvider) -> None:
        result = pg_provider.query(
            ["order_id", "amount"],
            sort=[SortSpec(column="amount", direction=SortDirection.ASC)],
        )
        amounts = [r["amount"] for r in result.rows]
        assert amounts == sorted(amounts)


# ---------------------------------------------------------------------------
# Simple aggregation (no pivot)
# ---------------------------------------------------------------------------

class TestPostgresSimpleAggregate:
    def test_group_by_region(self, pg_provider: SQLAlchemyProvider) -> None:
        result = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        sums = {r["region"]: r["sum_amount"] for r in result.rows}
        assert sums["US"] == 1000 + 2000 + 500 + 4000   # 7500
        assert sums["EU"] == 1500 + 3000                 # 4500
        assert sums["APAC"] == 6000 + 800                # 6800
        assert result.total == 3

    def test_group_by_two_columns(self, pg_provider: SQLAlchemyProvider) -> None:
        result = pg_provider.aggregate(
            group_by_rows=["region", "category"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total is not None
        assert result.total >= 4

    def test_multiple_measures(self, pg_provider: SQLAlchemyProvider) -> None:
        result = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[
                ValueSpec(column="amount", agg=AggFunc.SUM),
                ValueSpec(column="quantity", agg=AggFunc.SUM),
                ValueSpec(column="order_id", agg=AggFunc.COUNT),
            ],
        )
        us = next(r for r in result.rows if r["region"] == "US")
        assert us["count_order_id"] == 4

    def test_aggregate_limit_offset_no_sort(
        self, pg_provider: SQLAlchemyProvider,
    ) -> None:
        """OFFSET/FETCH in aggregation path."""
        r1 = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            limit=1,
            offset=0,
        )
        r2 = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            limit=1,
            offset=1,
        )
        assert r1.total == 3
        assert r2.total == 3
        assert len(r1.rows) == 1
        assert len(r2.rows) == 1
        assert r1.rows[0]["region"] != r2.rows[0]["region"]

    def test_aggregate_with_filter(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="category", operator=FilterOperator.EQ, value="Hardware",
            ),
        ])
        result = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            filter_group=fg,
        )
        sums = {r["region"]: r["sum_amount"] for r in result.rows}
        assert sums["US"] == 1000 + 2000 + 500 + 4000  # 7500
        assert sums["EU"] == 1500
        assert sums["APAC"] == 800

    def test_distinct_count(self, pg_provider: SQLAlchemyProvider) -> None:
        result = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="customer", agg=AggFunc.DISTINCT_COUNT)],
        )
        dc = {r["region"]: r["distinctCount_customer"] for r in result.rows}
        assert dc["US"] == 2   # Acme, Initech
        assert dc["EU"] == 1   # Globex
        assert dc["APAC"] == 1  # Umbrella


# ---------------------------------------------------------------------------
# Pivot aggregation
# ---------------------------------------------------------------------------

class TestPostgresPivotAggregate:
    def test_pivot_by_category(self, pg_provider: SQLAlchemyProvider) -> None:
        result = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["category"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 3
        col_keys = [c.key for c in result.columns]
        assert "region" in col_keys
        assert any("Hardware" in k for k in col_keys)
        assert any("Services" in k for k in col_keys)

        us_row = next(r for r in result.rows if r["region"] == "US")
        assert us_row["Hardware_sum_amount"] == 7500

    def test_pivot_with_multiple_measures(
        self, pg_provider: SQLAlchemyProvider,
    ) -> None:
        result = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["category"],
            values=[
                ValueSpec(column="amount", agg=AggFunc.SUM),
                ValueSpec(column="quantity", agg=AggFunc.SUM),
            ],
        )
        us_row = next(r for r in result.rows if r["region"] == "US")
        assert us_row["Hardware_sum_amount"] == 7500
        assert us_row["Hardware_sum_quantity"] == 10 + 20 + 5 + 40  # 75

    def test_pivot_limit_offset_no_sort(
        self, pg_provider: SQLAlchemyProvider,
    ) -> None:
        """OFFSET in pivot aggregation path."""
        r1 = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["category"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            limit=1,
            offset=0,
        )
        r2 = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["category"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            limit=1,
            offset=1,
        )
        assert r1.total == 3
        assert r2.total == 3
        assert len(r1.rows) == 1
        assert len(r2.rows) == 1
        assert r1.rows[0]["region"] != r2.rows[0]["region"]

    def test_multi_dim_pivot(self, pg_provider: SQLAlchemyProvider) -> None:
        """Pivot by (customer, category)."""
        result = pg_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["customer", "category"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 3
        # Verify pivot columns were generated
        pivot_cols = [c for c in result.columns if c.pivot_keys]
        assert len(pivot_cols) > 0
        assert all(len(c.pivot_keys) == 2 for c in pivot_cols)

    def test_pivot_with_filter(self, pg_provider: SQLAlchemyProvider) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(
                column="region", operator=FilterOperator.EQ, value="US",
            ),
        ])
        result = pg_provider.aggregate(
            group_by_rows=["customer"],
            group_by_cols=["category"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
            filter_group=fg,
        )
        assert result.total == 2  # Acme, Initech
        customers = {r["customer"] for r in result.rows}
        assert customers == {"Acme Corp", "Initech"}


# ---------------------------------------------------------------------------
# Deferred / lazy init against PostgreSQL
# ---------------------------------------------------------------------------

class TestPostgresDeferredInit:
    def test_autoload_with_single_table(
        self, pg_engine: sa.engine.Engine, pg_tables: dict[str, sa.Table],
    ) -> None:
        """autoload_with=engine pattern against a real PostgreSQL table."""
        orders_table_name = pg_tables["orders"].name

        p = SQLAlchemyProvider(
            key="pg_autoload",
            label="PG Autoloaded",
            engine=pg_engine,
            selectable=lambda eng: sa.Table(
                orders_table_name, sa.MetaData(), autoload_with=eng,
            ),
        )
        cols = p.get_columns()
        col_names = [c.name for c in cols]
        assert "order_id" in col_names
        assert "amount" in col_names

        result = p.query(["order_id", "amount"])
        assert result.total == 8

    def test_callable_selectable_with_join(
        self, pg_engine: sa.engine.Engine, pg_tables: dict[str, sa.Table],
    ) -> None:
        """Callable selectable that returns a joined SelectBase."""
        tbl_names = {k: v.name for k, v in pg_tables.items()}

        def factory(eng: sa.engine.Engine) -> sa.SelectBase:
            meta = sa.MetaData()
            orders = sa.Table(tbl_names["orders"], meta, autoload_with=eng)
            customers = sa.Table(tbl_names["customers"], meta, autoload_with=eng)
            return sa.select(
                orders.c.order_id,
                customers.c.name.label("customer"),
                orders.c.amount,
            ).select_from(
                orders.join(
                    customers,
                    orders.c.customer_id == customers.c.customer_id,
                )
            )

        p = SQLAlchemyProvider(
            key="pg_lazy_join",
            label="PG Lazy Join",
            engine=pg_engine,
            selectable=factory,
        )
        cols = p.get_columns()
        assert len(cols) == 3
        result = p.query([c.name for c in cols])
        assert result.total == 8


# ---------------------------------------------------------------------------
# Inferred provider — full query / aggregation / pivot
# ---------------------------------------------------------------------------

class TestPostgresInferredProviderQueries:
    """Run real queries through the auto-inferred-column provider.

    The inferred provider uses a joined SelectBase *without* explicit
    column defs, so every query exercises the ColumnClause code path
    end-to-end on PostgreSQL.
    """

    def test_flat_query(self, pg_inferred_provider: SQLAlchemyProvider) -> None:
        cols = [c.name for c in pg_inferred_provider.get_columns()]
        result = pg_inferred_provider.query(cols)
        assert result.total == 8
        assert len(result.rows) == 8

    def test_flat_query_with_filter(
        self, pg_inferred_provider: SQLAlchemyProvider,
    ) -> None:
        fg = FilterGroup(conditions=[
            FilterCondition(column="region", operator=FilterOperator.EQ, value="US"),
        ])
        result = pg_inferred_provider.query(
            ["order_id", "region"], filter_group=fg,
        )
        assert result.total == 4

    def test_flat_query_with_sort_and_pagination(
        self, pg_inferred_provider: SQLAlchemyProvider,
    ) -> None:
        r1 = pg_inferred_provider.query(
            ["order_id"],
            sort=[SortSpec(column="order_id", direction=SortDirection.ASC)],
            limit=4, offset=0,
        )
        r2 = pg_inferred_provider.query(
            ["order_id"],
            sort=[SortSpec(column="order_id", direction=SortDirection.ASC)],
            limit=4, offset=4,
        )
        assert [r["order_id"] for r in r1.rows] == [1, 2, 3, 4]
        assert [r["order_id"] for r in r2.rows] == [5, 6, 7, 8]

    def test_simple_aggregate(
        self, pg_inferred_provider: SQLAlchemyProvider,
    ) -> None:
        result = pg_inferred_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 3
        sums = {r["region"]: r["sum_amount"] for r in result.rows}
        assert sums["US"] == 7500
        assert sums["EU"] == 4500
        assert sums["APAC"] == 6800

    def test_pivot_aggregate(
        self, pg_inferred_provider: SQLAlchemyProvider,
    ) -> None:
        result = pg_inferred_provider.aggregate(
            group_by_rows=["region"],
            group_by_cols=["category"],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 3
        us_row = next(r for r in result.rows if r["region"] == "US")
        assert us_row["Hardware_sum_amount"] == 7500

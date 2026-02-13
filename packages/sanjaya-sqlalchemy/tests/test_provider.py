"""Tests for SQLAlchemyProvider — flat queries, aggregation, and pivot."""

from __future__ import annotations

import sqlalchemy as sa

from sanjaya_core.enums import AggFunc, ColumnType, FilterOperator, SortDirection
from sanjaya_core.filters import FilterCondition, FilterGroup
from sanjaya_core.types import ColumnMeta, SortSpec, ValueSpec

from sanjaya_sqlalchemy import SQLAlchemyProvider, columns_from_selectable, infer_column_type


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

    def test_limit_offset_without_explicit_sort(self, provider: SQLAlchemyProvider) -> None:
        """MSSQL requires ORDER BY when OFFSET is used.

        Even without an explicit sort the provider must add a deterministic
        fallback ORDER BY so the query doesn't fail on MSSQL / Azure SQL.
        """
        r1 = provider.query(["id", "desk"], limit=3, offset=0)
        r2 = provider.query(["id", "desk"], limit=3, offset=3)
        assert r1.total == 7
        # Pages must not overlap and together cover at least 6 rows.
        ids_1 = {r["id"] for r in r1.rows}
        ids_2 = {r["id"] for r in r2.rows}
        assert len(ids_1) == 3
        assert len(ids_2) == 3
        assert ids_1.isdisjoint(ids_2)

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


# ---------------------------------------------------------------------------
# Lazy engine
# ---------------------------------------------------------------------------


class TestLazyEngine:
    """Engine creation can be deferred via a callable."""

    def test_engine_factory_not_called_at_init(
        self, trades_table: sa.Table,
    ) -> None:
        """The factory must not be invoked during __init__."""
        called = False

        def factory() -> sa.engine.Engine:
            nonlocal called
            called = True
            return sa.create_engine("sqlite:///:memory:")

        SQLAlchemyProvider(
            key="lazy_test",
            label="Lazy",
            engine=factory,
            selectable=trades_table,
            columns=[],
        )
        assert not called, "engine factory should not be called at construction time"

    def test_engine_factory_called_on_first_query(
        self, engine: sa.engine.Engine, trades_table: sa.Table,
    ) -> None:
        """The factory is invoked on the first actual query."""
        from tests.conftest import COLUMN_DEFS

        call_count = 0

        def factory() -> sa.engine.Engine:
            nonlocal call_count
            call_count += 1
            return engine

        p = SQLAlchemyProvider(
            key="lazy_test",
            label="Lazy",
            engine=factory,
            selectable=trades_table,
            columns=COLUMN_DEFS,
        )

        assert call_count == 0
        result = p.query(["id", "desk"])
        assert call_count == 1
        assert result.total == 7

        # Subsequent queries reuse the engine — factory is not called again.
        p.query(["id"])
        assert call_count == 1


# ---------------------------------------------------------------------------
# Callable selectable
# ---------------------------------------------------------------------------


class TestCallableSelectable:
    """selectable can be a callable that receives the engine."""

    def test_nothing_called_at_init(self) -> None:
        """Neither engine nor selectable factories run during __init__."""
        engine_called = False
        selectable_called = False

        def engine_factory() -> sa.engine.Engine:
            nonlocal engine_called
            engine_called = True
            return sa.create_engine("sqlite:///:memory:")

        def selectable_factory(eng: sa.engine.Engine) -> sa.Table:
            nonlocal selectable_called
            selectable_called = True
            return sa.Table("x", sa.MetaData(), sa.Column("id", sa.Integer))

        SQLAlchemyProvider(
            key="deferred",
            label="Deferred",
            engine=engine_factory,
            selectable=selectable_factory,
        )
        assert not engine_called
        assert not selectable_called

    def test_selectable_receives_engine(
        self, engine: sa.engine.Engine, trades_table: sa.Table,
    ) -> None:
        """The selectable callable receives the materialised engine."""
        from tests.conftest import COLUMN_DEFS

        received_engine = None

        def selectable_factory(eng: sa.engine.Engine) -> sa.Table:
            nonlocal received_engine
            received_engine = eng
            return trades_table

        p = SQLAlchemyProvider(
            key="cb_sel",
            label="CB Selectable",
            engine=engine,
            selectable=selectable_factory,
            columns=COLUMN_DEFS,
        )
        result = p.query(["id", "desk"])
        assert received_engine is engine
        assert result.total == 7

    def test_autoload_with_pattern(self, engine: sa.engine.Engine) -> None:
        """Simulates the autoload_with=engine pattern."""
        p = SQLAlchemyProvider(
            key="autoloaded",
            label="Autoloaded",
            engine=engine,
            selectable=lambda eng: sa.Table(
                "trades", sa.MetaData(), autoload_with=eng,
            ),
        )
        # columns auto-inferred from the reflected table
        cols = p.get_columns()
        col_names = [c.name for c in cols]
        assert "id" in col_names
        assert "desk" in col_names
        assert "amount" in col_names

        result = p.query(col_names)
        assert result.total == 7

    def test_callable_selectable_with_select_base(
        self, engine: sa.engine.Engine,
    ) -> None:
        """Callable can return a SelectBase that gets auto-subqueried."""

        def factory(eng: sa.engine.Engine) -> sa.SelectBase:
            table = sa.Table("trades", sa.MetaData(), autoload_with=eng)
            return sa.select(table).where(table.c.desk == "FX")

        p = SQLAlchemyProvider(
            key="cb_select",
            label="CB Select",
            engine=engine,
            selectable=factory,
        )
        result = p.query([c.name for c in p.get_columns()])
        assert result.total == 4
        assert all(r["desk"] == "FX" for r in result.rows)


# ---------------------------------------------------------------------------
# Auto-inferred columns
# ---------------------------------------------------------------------------


class TestAutoInferredColumns:
    """columns=None auto-derives ColumnMeta from the selectable."""

    def test_infer_column_type_mapping(self) -> None:
        assert infer_column_type(sa.Integer()) == ColumnType.NUMBER
        assert infer_column_type(sa.Float()) == ColumnType.NUMBER
        assert infer_column_type(sa.Numeric()) == ColumnType.NUMBER
        assert infer_column_type(sa.String(50)) == ColumnType.STRING
        assert infer_column_type(sa.Text()) == ColumnType.STRING
        assert infer_column_type(sa.Boolean()) == ColumnType.BOOLEAN
        assert infer_column_type(sa.Date()) == ColumnType.DATE
        assert infer_column_type(sa.DateTime()) == ColumnType.DATETIME
        # Unknown types fall back to STRING
        assert infer_column_type(sa.LargeBinary()) == ColumnType.STRING

    def test_columns_from_selectable(self) -> None:
        metadata = sa.MetaData()
        table = sa.Table(
            "test",
            metadata,
            sa.Column("user_id", sa.Integer, primary_key=True),
            sa.Column("full_name", sa.String(100)),
            sa.Column("is_active", sa.Boolean),
        )
        cols = columns_from_selectable(table)
        assert len(cols) == 3

        by_name = {c.name: c for c in cols}
        assert by_name["user_id"].type == ColumnType.NUMBER
        assert by_name["user_id"].label == "User Id"
        assert by_name["full_name"].type == ColumnType.STRING
        assert by_name["full_name"].label == "Full Name"
        assert by_name["is_active"].type == ColumnType.BOOLEAN

    def test_omitted_columns_inferred(
        self, engine: sa.engine.Engine, trades_table: sa.Table,
    ) -> None:
        """Provider with columns=None derives them from the table."""
        p = SQLAlchemyProvider(
            key="inferred",
            label="Inferred",
            engine=engine,
            selectable=trades_table,
        )
        cols = p.get_columns()
        col_names = [c.name for c in cols]
        assert "id" in col_names
        assert "desk" in col_names
        assert "amount" in col_names

        # Types should be inferred correctly
        by_name = {c.name: c for c in cols}
        assert by_name["id"].type == ColumnType.NUMBER
        assert by_name["desk"].type == ColumnType.STRING
        assert by_name["amount"].type == ColumnType.NUMBER  # Float → NUMBER

    def test_explicit_columns_override_inference(
        self, engine: sa.engine.Engine, trades_table: sa.Table,
    ) -> None:
        """When columns are provided explicitly, inference is skipped."""
        custom_cols = [
            ColumnMeta(name="id", label="Trade ID", type=ColumnType.NUMBER),
        ]
        p = SQLAlchemyProvider(
            key="explicit",
            label="Explicit",
            engine=engine,
            selectable=trades_table,
            columns=custom_cols,
        )
        cols = p.get_columns()
        assert len(cols) == 1
        assert cols[0].label == "Trade ID"


# ---------------------------------------------------------------------------
# Fully deferred setup (engine + selectable + columns all lazy)
# ---------------------------------------------------------------------------


class TestFullyDeferredSetup:
    """The complete deferred pattern: nothing touches the DB until first use."""

    def test_fully_deferred_query(self, engine: sa.engine.Engine) -> None:
        engine_calls = 0

        def engine_factory() -> sa.engine.Engine:
            nonlocal engine_calls
            engine_calls += 1
            return engine

        p = SQLAlchemyProvider(
            key="full_lazy",
            label="Full Lazy",
            engine=engine_factory,
            selectable=lambda eng: sa.Table(
                "trades", sa.MetaData(), autoload_with=eng,
            ),
        )

        assert engine_calls == 0

        cols = p.get_columns()
        assert engine_calls == 1
        assert len(cols) >= 6

        result = p.query([c.name for c in cols])
        assert result.total == 7
        # Engine factory should only have been called once.
        assert engine_calls == 1

    def test_fully_deferred_aggregate(self, engine: sa.engine.Engine) -> None:
        p = SQLAlchemyProvider(
            key="full_lazy_agg",
            label="Full Lazy Agg",
            engine=lambda: engine,
            selectable=lambda eng: sa.Table(
                "trades", sa.MetaData(), autoload_with=eng,
            ),
        )
        result = p.aggregate(
            group_by_rows=["desk"],
            group_by_cols=[],
            values=[ValueSpec(column="amount", agg=AggFunc.SUM)],
        )
        assert result.total == 2
        sums = {r["desk"]: r["sum_amount"] for r in result.rows}
        assert sums["FX"] == 5000.0
        assert sums["Rates"] == 12000.0

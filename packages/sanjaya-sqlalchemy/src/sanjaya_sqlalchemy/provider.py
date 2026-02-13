"""SQLAlchemy Core implementation of :class:`~sanjaya_core.provider.DataProvider`.

``SQLAlchemyProvider`` is configured with a SQLAlchemy :class:`~sqlalchemy.Table`
(or selectable), a list of :class:`~sanjaya_core.types.ColumnMeta` definitions,
and a :class:`~sqlalchemy.engine.Engine`.  It translates every provider
method into SQL using SQLAlchemy Core expressions — no ORM required.

Usage example::

    from sqlalchemy import MetaData, create_engine
    from sanjaya_core.types import ColumnMeta, DatasetCapabilities
    from sanjaya_core.enums import ColumnType
    from sanjaya_sqlalchemy import SQLAlchemyProvider

    engine = create_engine("postgresql://...")
    metadata = MetaData()
    metadata.reflect(bind=engine)
    trade_table = metadata.tables["trade_activity"]

    provider = SQLAlchemyProvider(
        key="trade_activity",
        label="Trade Activity",
        engine=engine,
        selectable=trade_table,
        columns=[
            ColumnMeta(name="id", label="ID", type=ColumnType.NUMBER),
            ColumnMeta(name="desk", label="Desk", type=ColumnType.STRING),
            ColumnMeta(name="amount", label="Amount", type=ColumnType.CURRENCY),
            ...
        ],
        capabilities=DatasetCapabilities(pivot=True),
    )
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy import FromClause
from sqlalchemy.engine import Engine
from sqlalchemy.sql.expression import ColumnElement, SelectBase

from sanjaya_core.context import RequestContext
from sanjaya_core.enums import AggFunc, SortDirection
from sanjaya_core.filters import FilterGroup
from sanjaya_core.provider import DataProvider
from sanjaya_core.types import (
    AggregateColumn,
    AggregateResult,
    ColumnMeta,
    DatasetCapabilities,
    SortSpec,
    TabularResult,
    ValueSpec,
)

from sanjaya_sqlalchemy.filters import compile_filter_group


class SQLAlchemyProvider(DataProvider):
    """A :class:`DataProvider` backed by a SQLAlchemy selectable + engine.

    Parameters
    ----------
    key:
        Dataset identifier.
    label:
        Human-readable name.
    engine:
        A SQLAlchemy :class:`~sqlalchemy.engine.Engine` used to execute
        queries.
    selectable:
        The table, subquery, or select statement to query against
        (e.g. a :class:`~sqlalchemy.Table`, ``select()``, or any
        :class:`~sqlalchemy.sql.expression.SelectBase`).  A
        ``SelectBase`` is automatically wrapped via ``.subquery()``.
    columns:
        Column metadata definitions.  Each
        :attr:`~sanjaya_core.types.ColumnMeta.name` must match a column
        name in *selectable*.
    description:
        Optional description.
    capabilities:
        Optional capability flags.
    """

    def __init__(
        self,
        *,
        key: str,
        label: str,
        engine: Engine,
        selectable: FromClause | SelectBase,
        columns: list[ColumnMeta],
        description: str = "",
        capabilities: DatasetCapabilities | None = None,
    ) -> None:
        super().__init__(
            key=key,
            label=label,
            description=description,
            capabilities=capabilities or DatasetCapabilities(pivot=True),
        )
        self._engine = engine
        self._selectable: FromClause = (
            selectable.subquery() if isinstance(selectable, SelectBase) else selectable
        )
        self._columns = columns
        self._column_lookup: dict[str, ColumnElement[Any]] = {
            c.name: self._selectable.c[c.name] for c in columns
        }

    # ------------------------------------------------------------------
    # DataProvider interface
    # ------------------------------------------------------------------

    def get_columns(self) -> list[ColumnMeta]:
        return list(self._columns)

    def query(
        self,
        selected_columns: list[str],
        *,
        filter_group: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int = 100,
        offset: int = 0,
        ctx: RequestContext | None = None,
    ) -> TabularResult:
        # --- count ---
        count_stmt = sa.select(sa.func.count()).select_from(self._selectable)
        if filter_group:
            count_stmt = count_stmt.where(
                compile_filter_group(filter_group, self._column_lookup)
            )

        # --- data ---
        cols = [self._column_lookup[c] for c in selected_columns]
        data_stmt = sa.select(*cols).select_from(self._selectable)
        if filter_group:
            data_stmt = data_stmt.where(
                compile_filter_group(filter_group, self._column_lookup)
            )
        data_stmt = self._apply_sort(data_stmt, sort)
        data_stmt = data_stmt.limit(limit).offset(offset)

        with self._engine.connect() as conn:
            total = conn.execute(count_stmt).scalar_one()
            rows = [dict(r._mapping) for r in conn.execute(data_stmt)]

        return TabularResult(columns=selected_columns, rows=rows, total=total)

    def aggregate(
        self,
        group_by_rows: list[str],
        group_by_cols: list[str],
        values: list[ValueSpec],
        *,
        filter_group: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int = 0,
        ctx: RequestContext | None = None,
    ) -> AggregateResult:
        if group_by_cols:
            return self._pivot_aggregate(
                group_by_rows, group_by_cols, values,
                filter_group=filter_group, sort=sort,
                limit=limit, offset=offset,
            )
        return self._simple_aggregate(
            group_by_rows, values,
            filter_group=filter_group, sort=sort,
            limit=limit, offset=offset,
        )

    # ------------------------------------------------------------------
    # Internal: simple (non-pivot) aggregation
    # ------------------------------------------------------------------

    def _simple_aggregate(
        self,
        group_by_rows: list[str],
        values: list[ValueSpec],
        *,
        filter_group: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> AggregateResult:
        # Build SELECT clause: group-by columns + aggregate expressions.
        group_cols = [self._column_lookup[c] for c in group_by_rows]
        agg_exprs: list[tuple[str, ColumnElement[Any]]] = []
        result_columns: list[AggregateColumn] = []

        for col_name in group_by_rows:
            result_columns.append(
                AggregateColumn(key=col_name, header=col_name)
            )

        for vs in values:
            key = f"{vs.agg}_{vs.column}"
            sa_expr = self._agg_expression(vs)
            agg_exprs.append((key, sa_expr))
            result_columns.append(
                AggregateColumn(
                    key=key,
                    header=vs.label or key,
                    measure=vs.column,
                    agg=vs.agg,
                )
            )

        select_cols = [
            *[c.label(c.name) for c in group_cols],
            *[expr.label(key) for key, expr in agg_exprs],
        ]

        # --- count (total groups) ---
        count_sub = (
            sa.select(*[c.label(c.name) for c in group_cols])
            .select_from(self._selectable)
            .group_by(*group_cols)
        )
        if filter_group:
            count_sub = count_sub.where(
                compile_filter_group(filter_group, self._column_lookup)
            )
        count_stmt = sa.select(sa.func.count()).select_from(count_sub.subquery())

        # --- data ---
        data_stmt = (
            sa.select(*select_cols)
            .select_from(self._selectable)
            .group_by(*group_cols)
        )
        if filter_group:
            data_stmt = data_stmt.where(
                compile_filter_group(filter_group, self._column_lookup)
            )
        data_stmt = self._apply_sort(data_stmt, sort)
        if limit is not None:
            data_stmt = data_stmt.limit(limit)
        data_stmt = data_stmt.offset(offset)

        with self._engine.connect() as conn:
            total = conn.execute(count_stmt).scalar_one()
            rows = [dict(r._mapping) for r in conn.execute(data_stmt)]

        return AggregateResult(columns=result_columns, rows=rows, total=total)

    # ------------------------------------------------------------------
    # Internal: pivot aggregation
    # ------------------------------------------------------------------

    def _pivot_aggregate(
        self,
        group_by_rows: list[str],
        group_by_cols: list[str],
        values: list[ValueSpec],
        *,
        filter_group: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> AggregateResult:
        """Two-pass pivot: discover combos, then aggregate per combo.

        SQLAlchemy Core doesn't have built-in PIVOT support, so we:
        1. Query distinct pivot-column combinations.
        2. Build one ``CASE WHEN … END`` per (combo × measure) to simulate
           a pivot in a single grouped query.
        """
        where_clause: ColumnElement[bool] | None = None
        if filter_group:
            where_clause = compile_filter_group(
                filter_group, self._column_lookup
            )

        # --- pass 1: discover distinct pivot combos ---
        pivot_sa_cols = [self._column_lookup[c] for c in group_by_cols]
        combo_stmt = (
            sa.select(*pivot_sa_cols)
            .select_from(self._selectable)
            .distinct()
        )
        if where_clause is not None:
            combo_stmt = combo_stmt.where(where_clause)
        # Deterministic ordering of combos.
        combo_stmt = combo_stmt.order_by(*pivot_sa_cols)

        with self._engine.connect() as conn:
            combos = [tuple(r._mapping[c] for c in group_by_cols) for r in conn.execute(combo_stmt)]

        # --- build result column metadata + CASE expressions ---
        group_row_cols = [self._column_lookup[c] for c in group_by_rows]

        result_columns: list[AggregateColumn] = []
        for col_name in group_by_rows:
            result_columns.append(
                AggregateColumn(key=col_name, header=col_name)
            )

        case_exprs: list[tuple[str, ColumnElement[Any]]] = []

        for combo in combos:
            # Build the CASE WHEN condition for this combo.
            combo_cond = sa.and_(
                *(
                    self._column_lookup[group_by_cols[i]] == combo[i]
                    for i in range(len(group_by_cols))
                )
            )
            for vs in values:
                pivot_key_parts = [str(v) for v in combo]
                col_key = "_".join(pivot_key_parts + [vs.agg, vs.column])
                result_columns.append(
                    AggregateColumn(
                        key=col_key,
                        header=col_key,
                        pivot_keys=pivot_key_parts,
                        measure=vs.column,
                        agg=vs.agg,
                    )
                )
                # CASE WHEN <combo_cond> THEN <measure_col> END → wrapped in agg
                measure_col = self._column_lookup[vs.column]
                case_expr = sa.case((combo_cond, measure_col))
                agg_expr = self._wrap_agg(vs.agg, case_expr)
                case_exprs.append((col_key, agg_expr))

        # --- pass 2: grouped query with CASE expressions ---
        select_cols = [
            *[c.label(c.name) for c in group_row_cols],
            *[expr.label(key) for key, expr in case_exprs],
        ]

        # count total groups
        count_sub = (
            sa.select(*[c.label(c.name) for c in group_row_cols])
            .select_from(self._selectable)
            .group_by(*group_row_cols)
        )
        if where_clause is not None:
            count_sub = count_sub.where(where_clause)
        count_stmt = sa.select(sa.func.count()).select_from(count_sub.subquery())

        data_stmt = (
            sa.select(*select_cols)
            .select_from(self._selectable)
            .group_by(*group_row_cols)
        )
        if where_clause is not None:
            data_stmt = data_stmt.where(where_clause)
        data_stmt = self._apply_sort(data_stmt, sort)
        if limit is not None:
            data_stmt = data_stmt.limit(limit)
        data_stmt = data_stmt.offset(offset)

        with self._engine.connect() as conn:
            total = conn.execute(count_stmt).scalar_one()
            rows = [dict(r._mapping) for r in conn.execute(data_stmt)]

        return AggregateResult(columns=result_columns, rows=rows, total=total)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _apply_sort(
        self,
        stmt: sa.Select[Any],
        sort: list[SortSpec] | None,
    ) -> sa.Select[Any]:
        """Append ORDER BY clauses to *stmt*."""
        if not sort:
            return stmt
        clauses = []
        for spec in sort:
            col = self._column_lookup[spec.column]
            clauses.append(
                col.desc() if spec.direction == SortDirection.DESC else col.asc()
            )
        return stmt.order_by(*clauses)

    def _agg_expression(self, vs: ValueSpec) -> ColumnElement[Any]:
        """Build a SQLAlchemy aggregate expression for a :class:`ValueSpec`."""
        col = self._column_lookup[vs.column]
        return self._wrap_agg(vs.agg, col)

    @staticmethod
    def _wrap_agg(agg: AggFunc, expr: ColumnElement[Any]) -> ColumnElement[Any]:
        """Wrap *expr* in the SQL aggregate function for *agg*."""
        match agg:
            case AggFunc.SUM:
                return sa.func.sum(expr)
            case AggFunc.AVG:
                return sa.func.avg(expr)
            case AggFunc.MIN:
                return sa.func.min(expr)
            case AggFunc.MAX:
                return sa.func.max(expr)
            case AggFunc.COUNT:
                return sa.func.count(expr)
            case AggFunc.DISTINCT_COUNT:
                return sa.func.count(sa.distinct(expr))
            case AggFunc.FIRST:
                return sa.func.min(expr)  # approximation — no SQL FIRST
            case AggFunc.LAST:
                return sa.func.max(expr)  # approximation — no SQL LAST
            case _:
                return sa.func.count(expr)

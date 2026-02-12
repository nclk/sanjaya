"""In-memory data provider for testing.

``MockDataProvider`` implements the full :class:`DataProvider` interface
backed by a plain ``list[dict]``.  It supports:

* Column projection (``selected_columns``)
* Recursive :class:`FilterGroup` evaluation
* Multi-column sorting
* Limit / offset pagination
* Aggregation with all :class:`AggFunc` functions
* Pivot column expansion (group-by-cols → dynamic result columns)
"""

from __future__ import annotations

from collections import defaultdict
from itertools import islice
from typing import Any

from sanjaya_core.context import RequestContext
from sanjaya_core.enums import AggFunc, ColumnType, SortDirection
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


class MockDataProvider(DataProvider):
    """A data provider backed by an in-memory list of row dicts.

    Parameters
    ----------
    key:
        Dataset identifier.
    label:
        Human-readable name.
    columns:
        Column metadata definitions.
    data:
        The actual row data (list of dicts).
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
        columns: list[ColumnMeta],
        data: list[dict[str, Any]],
        description: str = "",
        capabilities: DatasetCapabilities | None = None,
    ) -> None:
        super().__init__(
            key=key,
            label=label,
            description=description,
            capabilities=capabilities or DatasetCapabilities(pivot=True),
        )
        self._columns = columns
        self._data = data

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
        rows = self._apply_filter(self._data, filter_group)
        total = len(rows)
        rows = self._apply_sort(rows, sort)
        rows = list(islice(rows, offset, offset + limit if limit else None))
        rows = self._project(rows, selected_columns)
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
        rows = self._apply_filter(self._data, filter_group)

        # Group rows by (row_dims..., col_dims...).
        all_group_keys = group_by_rows + group_by_cols
        buckets: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            gk = tuple(row.get(c) for c in all_group_keys)
            buckets[gk].append(row)

        if group_by_cols:
            return self._pivot_aggregate(
                buckets, group_by_rows, group_by_cols, values, sort, limit, offset
            )
        else:
            return self._simple_aggregate(
                buckets, group_by_rows, values, sort, limit, offset
            )

    # ------------------------------------------------------------------
    # Internal: filtering
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_filter(
        rows: list[dict[str, Any]], fg: FilterGroup | None
    ) -> list[dict[str, Any]]:
        if fg is None:
            return list(rows)
        return [r for r in rows if fg.evaluate(r)]

    # ------------------------------------------------------------------
    # Internal: sorting
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_sort(
        rows: list[dict[str, Any]], sort: list[SortSpec] | None
    ) -> list[dict[str, Any]]:
        if not sort:
            return rows
        for spec in reversed(sort):
            rows = sorted(
                rows,
                key=lambda r, c=spec.column: (
                    (0, r.get(c)) if r.get(c) is not None else (1,)
                ),
                reverse=(spec.direction == SortDirection.DESC),
            )
        return rows

    # ------------------------------------------------------------------
    # Internal: projection
    # ------------------------------------------------------------------

    @staticmethod
    def _project(
        rows: list[dict[str, Any]], columns: list[str]
    ) -> list[dict[str, Any]]:
        return [{c: r.get(c) for c in columns} for r in rows]

    # ------------------------------------------------------------------
    # Internal: simple (non-pivot) aggregation
    # ------------------------------------------------------------------

    def _simple_aggregate(
        self,
        buckets: dict[tuple[Any, ...], list[dict[str, Any]]],
        group_by_rows: list[str],
        values: list[ValueSpec],
        sort: list[SortSpec] | None,
        limit: int | None,
        offset: int,
    ) -> AggregateResult:
        # Build result columns: group dims + value aggs.
        result_columns: list[AggregateColumn] = []
        for col_name in group_by_rows:
            result_columns.append(
                AggregateColumn(key=col_name, header=col_name)
            )
        for vs in values:
            key = f"{vs.agg}_{vs.column}"
            result_columns.append(
                AggregateColumn(
                    key=key,
                    header=vs.label or key,
                    measure=vs.column,
                    agg=vs.agg,
                )
            )

        result_rows: list[dict[str, Any]] = []
        for gk, bucket in buckets.items():
            row: dict[str, Any] = {}
            for i, col_name in enumerate(group_by_rows):
                row[col_name] = gk[i]
            for vs in values:
                key = f"{vs.agg}_{vs.column}"
                row[key] = _compute_agg(vs.agg, vs.column, bucket)
            result_rows.append(row)

        result_rows = self._apply_sort(result_rows, sort)
        total = len(result_rows)
        end = (offset + limit) if limit else None
        result_rows = result_rows[offset:end]

        return AggregateResult(
            columns=result_columns, rows=result_rows, total=total
        )

    # ------------------------------------------------------------------
    # Internal: pivot aggregation
    # ------------------------------------------------------------------

    def _pivot_aggregate(
        self,
        buckets: dict[tuple[Any, ...], list[dict[str, Any]]],
        group_by_rows: list[str],
        group_by_cols: list[str],
        values: list[ValueSpec],
        sort: list[SortSpec] | None,
        limit: int | None,
        offset: int,
    ) -> AggregateResult:
        n_row_dims = len(group_by_rows)

        # Discover all unique pivot-column combinations.
        pivot_combos: set[tuple[Any, ...]] = set()
        for gk in buckets:
            pivot_combos.add(gk[n_row_dims:])

        sorted_combos = sorted(pivot_combos)

        # Build result columns: row dims + (pivot_combo × value_specs).
        result_columns: list[AggregateColumn] = []
        for col_name in group_by_rows:
            result_columns.append(
                AggregateColumn(key=col_name, header=col_name)
            )
        for combo in sorted_combos:
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

        # Collect rows grouped by row-dims only, accumulating across pivot combos.
        row_groups: dict[tuple[Any, ...], dict[str, Any]] = {}
        for gk, bucket in buckets.items():
            row_key = gk[:n_row_dims]
            if row_key not in row_groups:
                row_groups[row_key] = {
                    col_name: gk[i] for i, col_name in enumerate(group_by_rows)
                }
            dest = row_groups[row_key]
            pivot_combo = gk[n_row_dims:]
            for vs in values:
                pivot_key_parts = [str(v) for v in pivot_combo]
                col_key = "_".join(pivot_key_parts + [vs.agg, vs.column])
                dest[col_key] = _compute_agg(vs.agg, vs.column, bucket)

        result_rows = list(row_groups.values())
        result_rows = self._apply_sort(result_rows, sort)
        total = len(result_rows)
        end = (offset + limit) if limit else None
        result_rows = result_rows[offset:end]

        return AggregateResult(
            columns=result_columns, rows=result_rows, total=total
        )


# ------------------------------------------------------------------
# Aggregation helpers
# ------------------------------------------------------------------


def _compute_agg(
    agg: AggFunc, column: str, rows: list[dict[str, Any]]
) -> Any:
    """Compute a single aggregate over *column* in *rows*."""
    raw = [r.get(column) for r in rows]
    non_null = [v for v in raw if v is not None]

    match agg:
        case AggFunc.COUNT:
            return len(raw)
        case AggFunc.DISTINCT_COUNT:
            return len(set(raw))
        case AggFunc.SUM:
            return sum(non_null) if non_null else None
        case AggFunc.AVG:
            return (sum(non_null) / len(non_null)) if non_null else None
        case AggFunc.MIN:
            return min(non_null) if non_null else None
        case AggFunc.MAX:
            return max(non_null) if non_null else None
        case AggFunc.FIRST:
            return raw[0] if raw else None
        case AggFunc.LAST:
            return raw[-1] if raw else None
        case _:
            return None

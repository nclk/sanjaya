"""AG Grid ↔ sanjaya-core translation layer.

This module is the seam between the AG Grid SSRM wire format and the
grid-agnostic ``DataProvider.aggregate()`` interface.  It is isolated so
that:

* The provider ABC never sees AG Grid types.
* A future non-AG-Grid consumer could introduce a different endpoint shape
  that calls the same provider method.
"""

from __future__ import annotations

from sanjaya_core import (
    AggFunc,
    DataProvider,
    FilterGroup,
    SortDirection,
)
from sanjaya_core.context import RequestContext
from sanjaya_core.enums import FilterCombinator, FilterOperator
from sanjaya_core.filters import FilterCondition
from sanjaya_core.types import (
    AggregateResult,
    SortSpec,
    ValueSpec,
)

from sanjaya.schemas.filters import parse_ag_grid_filter_model
from sanjaya.schemas.pivot import (
    ServerSideGetRowsRequest,
    ServerSideGetRowsResponse,
)


def handle_ssrm_request(
    provider: DataProvider,
    request: ServerSideGetRowsRequest,
    *,
    ctx: RequestContext | None = None,
) -> ServerSideGetRowsResponse:
    """Translate an AG Grid SSRM request, call the provider, and format the response."""

    # --- Build filter group ---
    filter_group = parse_ag_grid_filter_model(request.filter_model)

    # Inject groupKeys as equality filters (drill-down into expanded groups).
    if request.group_keys:
        group_key_conditions = []
        for i, key_value in enumerate(request.group_keys):
            col = request.row_group_cols[i]
            group_key_conditions.append(
                FilterCondition(
                    column=col.field or col.id,
                    operator=FilterOperator.EQ,
                    value=key_value,
                )
            )
        gk_group = FilterGroup(
            combinator=FilterCombinator.AND,
            conditions=group_key_conditions,
        )
        if filter_group is not None:
            filter_group = FilterGroup(
                combinator=FilterCombinator.AND,
                groups=[filter_group, gk_group],
            )
        else:
            filter_group = gk_group

    # --- Determine which row-group level we're fetching ---
    # AG Grid sends groupKeys for expanded levels.  The next level to
    # GROUP BY is the one at index len(groupKeys).
    depth = len(request.group_keys)
    all_row_group_fields = [
        c.field or c.id for c in request.row_group_cols
    ]

    if depth < len(all_row_group_fields):
        # Still drilling down — group by the next level.
        group_by_rows = [all_row_group_fields[depth]]
    else:
        # Leaf level — no more grouping; return detail rows.
        group_by_rows = []

    # --- Pivot columns ---
    group_by_cols = (
        [c.field or c.id for c in request.pivot_cols]
        if request.pivot_mode and request.pivot_cols
        else []
    )

    # --- Value columns ---
    values = [
        ValueSpec(
            column=c.field or c.id,
            agg=c.agg_func or AggFunc.SUM,
            label=c.display_name,
        )
        for c in request.value_cols
    ]

    # --- Sort ---
    sort: list[SortSpec] | None = None
    if request.sort_model:
        sort = [
            SortSpec(
                column=s.col_id,
                direction=SortDirection.DESC if s.sort == "desc" else SortDirection.ASC,
            )
            for s in request.sort_model
        ]

    # --- Pagination ---
    limit = request.end_row - request.start_row
    offset = request.start_row

    # --- If we're at leaf level with no grouping, do a flat query ---
    if not group_by_rows and not group_by_cols:
        # Determine columns to select — value col fields, or fall back to all.
        select_cols = [c.field or c.id for c in request.value_cols] if request.value_cols else [
            c.name for c in provider.get_columns()
        ]
        # Add any row group cols that were fully expanded as context columns.
        for f in all_row_group_fields:
            if f not in select_cols:
                select_cols.insert(0, f)

        result = provider.query(
            select_cols,
            filter_group=filter_group,
            sort=sort,
            limit=limit,
            offset=offset,
            ctx=ctx,
        )
        return ServerSideGetRowsResponse(
            row_data=result.rows,
            row_count=result.total,
        )

    # --- Aggregation call ---
    agg_result: AggregateResult = provider.aggregate(
        group_by_rows=group_by_rows,
        group_by_cols=group_by_cols,
        values=values,
        filter_group=filter_group,
        sort=sort,
        limit=limit,
        offset=offset,
        ctx=ctx,
    )

    # --- Build response ---
    pivot_result_fields: list[str] | None = None
    if group_by_cols:
        pivot_result_fields = [
            col.key for col in agg_result.columns if col.pivot_keys
        ]

    return ServerSideGetRowsResponse(
        row_data=agg_result.rows,
        row_count=agg_result.total,
        pivot_result_fields=pivot_result_fields,
    )

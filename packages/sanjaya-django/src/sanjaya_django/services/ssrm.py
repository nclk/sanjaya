"""AG Grid ↔ sanjaya-core SSRM translation layer.

This module is the seam between the AG Grid SSRM wire format and the
grid-agnostic ``DataProvider`` interface.  It provides two entry points:

* ``handle_table_ssrm_request`` — flat data, row grouping, aggregation (no pivot).
* ``handle_ssrm_request`` — pivot queries (requires pivot columns).

Both share the same filter / sort / pagination helpers so that the
provider ABC never sees AG Grid types.
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

from sanjaya_django.schemas.filters import parse_ag_grid_filter_model, parse_filter_group
from sanjaya_django.schemas.pivot import (
    ServerSideGetRowsRequest,
    ServerSideGetRowsResponse,
)
from sanjaya_django.schemas.ssrm import (
    SSRMBaseRequest,
    TableGetRowsRequest,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _build_filter_group(
    request: SSRMBaseRequest,
) -> FilterGroup | None:
    """Parse the filter from the request.

    Checks ``filter`` (rich FilterGroup format) first.  Falls back to
    ``filterModel`` (AG Grid column-keyed format) if ``filter`` is absent.
    Then injects groupKey equality filters for drill-down.
    """
    if request.filter is not None:
        filter_group = parse_filter_group(request.filter)
    else:
        filter_group = parse_ag_grid_filter_model(request.filter_model)

    if request.group_keys:
        group_key_conditions = [
            FilterCondition(
                column=request.row_group_cols[i].field or request.row_group_cols[i].id,
                operator=FilterOperator.EQ,
                value=key_value,
            )
            for i, key_value in enumerate(request.group_keys)
        ]
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

    return filter_group


def _resolve_row_groups(request: SSRMBaseRequest) -> tuple[list[str], list[str]]:
    """Return ``(group_by_rows, all_row_group_fields)`` based on depth."""
    depth = len(request.group_keys)
    all_row_group_fields = [c.field or c.id for c in request.row_group_cols]

    if depth < len(all_row_group_fields):
        group_by_rows = [all_row_group_fields[depth]]
    else:
        group_by_rows = []

    return group_by_rows, all_row_group_fields


def _build_values(request: SSRMBaseRequest) -> list[ValueSpec]:
    return [
        ValueSpec(
            column=c.field or c.id,
            agg=c.agg_func or AggFunc.SUM,
            label=c.display_name,
        )
        for c in request.value_cols
    ]


def _build_sort(request: SSRMBaseRequest) -> list[SortSpec] | None:
    if not request.sort_model:
        return None
    return [
        SortSpec(
            column=s.col_id,
            direction=SortDirection.DESC if s.sort == "desc" else SortDirection.ASC,
        )
        for s in request.sort_model
    ]


def _pagination(request: SSRMBaseRequest) -> tuple[int, int]:
    return request.end_row - request.start_row, request.start_row


# ---------------------------------------------------------------------------
# Table handler (flat data + row grouping + aggregation, no pivot)
# ---------------------------------------------------------------------------


def handle_table_ssrm_request(
    provider: DataProvider,
    request: TableGetRowsRequest,
    *,
    ctx: RequestContext | None = None,
) -> ServerSideGetRowsResponse:
    """Handle an AG Grid SSRM request for the table endpoint (no pivot)."""

    filter_group = _build_filter_group(request)
    group_by_rows, all_row_group_fields = _resolve_row_groups(request)
    sort = _build_sort(request)
    limit, offset = _pagination(request)

    # Leaf level — no more grouping; return flat detail rows.
    if not group_by_rows:
        select_cols = (
            [c.field or c.id for c in request.value_cols]
            if request.value_cols
            else [c.name for c in provider.get_columns()]
        )
        # Prepend any row group cols that were fully expanded as context.
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

    # Non-leaf — aggregate with row groups only (no pivot columns).
    values = _build_values(request)
    agg_result: AggregateResult = provider.aggregate(
        group_by_rows=group_by_rows,
        group_by_cols=[],
        values=values,
        filter_group=filter_group,
        sort=sort,
        limit=limit,
        offset=offset,
        ctx=ctx,
    )

    return ServerSideGetRowsResponse(
        row_data=agg_result.rows,
        row_count=agg_result.total,
    )


# ---------------------------------------------------------------------------
# Pivot handler (requires pivot columns)
# ---------------------------------------------------------------------------


def handle_ssrm_request(
    provider: DataProvider,
    request: ServerSideGetRowsRequest,
    *,
    ctx: RequestContext | None = None,
) -> ServerSideGetRowsResponse:
    """Handle an AG Grid SSRM request for the pivot endpoint."""

    filter_group = _build_filter_group(request)
    group_by_rows, _all_row_group_fields = _resolve_row_groups(request)
    sort = _build_sort(request)
    limit, offset = _pagination(request)
    values = _build_values(request)

    group_by_cols = [c.field or c.id for c in request.pivot_cols]

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

    # Build pivot result fields from columns that have pivot keys.
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

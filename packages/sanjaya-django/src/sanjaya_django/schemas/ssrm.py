"""Shared AG Grid SSRM schemas used by both the table and pivot endpoints."""

from __future__ import annotations

from typing import Any

from sanjaya_core.enums import AggFunc, ColumnType

from sanjaya_django.schemas import CamelSchema


# ---------------------------------------------------------------------------
# Shared types (used by table, pivot, and export)
# ---------------------------------------------------------------------------


class ColumnVO(CamelSchema):
    id: str
    display_name: str
    field: str | None = None
    agg_func: AggFunc | None = None


class SortModelItem(CamelSchema):
    col_id: str
    sort: str  # "asc" | "desc"


# ---------------------------------------------------------------------------
# Shared request base
# ---------------------------------------------------------------------------


class SSRMBaseRequest(CamelSchema):
    """Fields common to both the table and pivot SSRM endpoints."""

    start_row: int
    end_row: int
    row_group_cols: list[ColumnVO]
    group_keys: list[str]
    value_cols: list[ColumnVO]
    sort_model: list[SortModelItem] | None = None
    filter: dict[str, Any] | None = None
    filter_model: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Table request (no pivot)
# ---------------------------------------------------------------------------


class TableGetRowsRequest(SSRMBaseRequest):
    """AG Grid SSRM request for the table endpoint.

    Supports flat data, row grouping, and aggregation — but no pivoting.
    """


# ---------------------------------------------------------------------------
# Response (shared by both endpoints)
# ---------------------------------------------------------------------------


class PivotResultColDef(CamelSchema):
    col_id: str
    header_name: str
    field: str
    type: ColumnType | None = None
    children: list[PivotResultColDef] | None = None
    pivot_meta: dict | None = None


class ServerSideGetRowsResponse(CamelSchema):
    row_data: list[dict[str, Any]]
    row_count: int | None = None
    pivot_result_fields: list[str] | None = None
    secondary_col_defs: list[PivotResultColDef] | None = None

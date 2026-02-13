"""Schemas for the AG Grid SSRM pivot endpoint."""

from __future__ import annotations

from typing import Any

from ninja import Schema

from sanjaya_core.enums import AggFunc, ColumnType


# ---------------------------------------------------------------------------
# Request (mirrors IServerSideGetRowsRequest)
# ---------------------------------------------------------------------------


class ColumnVO(Schema):
    id: str
    display_name: str
    field: str | None = None
    agg_func: AggFunc | None = None


class SortModelItem(Schema):
    col_id: str
    sort: str  # "asc" | "desc"


class ServerSideGetRowsRequest(Schema):
    start_row: int
    end_row: int
    row_group_cols: list[ColumnVO]
    group_keys: list[str]
    value_cols: list[ColumnVO]
    pivot_cols: list[ColumnVO]
    pivot_mode: bool
    sort_model: list[SortModelItem] | None = None
    filter_model: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------


class PivotResultColDef(Schema):
    col_id: str
    header_name: str
    field: str
    type: ColumnType | None = None
    children: list[PivotResultColDef] | None = None
    pivot_meta: dict | None = None


class ServerSideGetRowsResponse(Schema):
    row_data: list[dict[str, Any]]
    row_count: int | None = None
    pivot_result_fields: list[str] | None = None
    secondary_col_defs: list[PivotResultColDef] | None = None

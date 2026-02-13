"""Schemas for the export endpoint."""

from __future__ import annotations

from typing import Any

from ninja import Schema

from sanjaya_core.enums import AggFunc, ExportFormat


class ColumnVOExport(Schema):
    """Same shape as pivot ColumnVO, reused for export requests."""

    id: str
    display_name: str
    field: str | None = None
    agg_func: AggFunc | None = None


class SortModelItemExport(Schema):
    col_id: str
    sort: str


class FlatExportRequest(Schema):
    selected_columns: list[str]
    filter: dict | None = None  # raw FilterGroup JSON
    format: ExportFormat


class PivotExportRequest(Schema):
    row_group_cols: list[ColumnVOExport]
    value_cols: list[ColumnVOExport]
    pivot_cols: list[ColumnVOExport]
    filter_model: dict[str, Any] | None = None
    sort_model: list[SortModelItemExport] | None = None
    format: ExportFormat


class ExportRequest(Schema):
    flat: FlatExportRequest | None = None
    pivot: PivotExportRequest | None = None

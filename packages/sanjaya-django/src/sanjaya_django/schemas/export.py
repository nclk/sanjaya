"""Schemas for the export endpoint."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from sanjaya_core.enums import AggFunc, ExportFormat

from sanjaya_django.schemas import CamelSchema


class ColumnVOExport(CamelSchema):
    """Same shape as pivot ColumnVO, reused for export requests."""

    id: str
    display_name: str
    field: str | None = None
    agg_func: AggFunc | None = None


class SortModelItemExport(CamelSchema):
    col_id: str
    sort: str


class FlatExportRequest(CamelSchema):
    selected_columns: list[str] = Field(min_length=1)
    filter: dict | None = None  # raw FilterGroup JSON
    format: ExportFormat


class PivotExportRequest(CamelSchema):
    row_group_cols: list[ColumnVOExport]
    value_cols: list[ColumnVOExport]
    pivot_cols: list[ColumnVOExport]
    filter_model: dict[str, Any] | None = None
    sort_model: list[SortModelItemExport] | None = None
    format: ExportFormat


class ExportRequest(CamelSchema):
    flat: FlatExportRequest | None = None
    pivot: PivotExportRequest | None = None

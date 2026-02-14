"""Schemas for the export endpoint."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from sanjaya_core.enums import ExportFormat

from sanjaya_django.schemas import CamelSchema
from sanjaya_django.schemas.ssrm import ColumnVO, SortModelItem


class FlatExportRequest(CamelSchema):
    selected_columns: list[str] = Field(min_length=1)
    filter: dict | None = None  # raw FilterGroup JSON
    format: ExportFormat


class GroupedExportRequest(CamelSchema):
    """Export a row-grouped aggregation (table tab with groups, no pivot).

    Produces a flat table with one row per group combination.
    """

    row_group_cols: list[ColumnVO]
    value_cols: list[ColumnVO]
    filter_model: dict[str, Any] | None = None
    sort_model: list[SortModelItem] | None = None
    format: ExportFormat


class PivotExportRequest(CamelSchema):
    row_group_cols: list[ColumnVO]
    value_cols: list[ColumnVO]
    pivot_cols: list[ColumnVO]
    filter_model: dict[str, Any] | None = None
    sort_model: list[SortModelItem] | None = None
    format: ExportFormat


class ExportRequest(CamelSchema):
    flat: FlatExportRequest | None = None
    grouped: GroupedExportRequest | None = None
    pivot: PivotExportRequest | None = None

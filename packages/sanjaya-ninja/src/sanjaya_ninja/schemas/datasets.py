"""Schemas for dataset and column endpoints."""

from __future__ import annotations

from ninja import Schema

from sanjaya_core.enums import (
    AggFunc,
    ColumnType,
    FilterOperator,
    FilterStyle,
    FormatHintKind,
)


# ---------------------------------------------------------------------------
# Column metadata (mirrors sanjaya_core.types.ColumnMeta for the wire)
# ---------------------------------------------------------------------------


class CurrencyOptionsOut(Schema):
    default_unit: str | None = None
    supported_units: list[str] | None = None
    default_magnitude: str | None = None
    supported_magnitudes: list[str] | None = None


class FormatHintsOut(Schema):
    kind: FormatHintKind
    decimals: int | None = None
    currency_code: str | None = None
    currency_code_column: str | None = None


class PivotAggOptionOut(Schema):
    agg: AggFunc
    label: str


class ColumnPivotOptionsOut(Schema):
    role: str | None = None
    allowed_aggs: list[PivotAggOptionOut] | None = None


class ColumnOut(Schema):
    name: str
    label: str
    type: ColumnType
    format: str | None = None
    enum_values: list[str] | None = None
    operators: list[FilterOperator]
    nullable: bool
    currency: CurrencyOptionsOut | None = None
    pivot: ColumnPivotOptionsOut | None = None
    format_hints: FormatHintsOut | None = None
    filter_style: FilterStyle | None = None


class ColumnsResponse(Schema):
    columns: list[ColumnOut]


# ---------------------------------------------------------------------------
# Dataset listing
# ---------------------------------------------------------------------------


class DatasetCapabilitiesOut(Schema):
    pivot: bool


class DatasetOut(Schema):
    key: str
    label: str
    description: str
    capabilities: DatasetCapabilitiesOut


class DatasetsResponse(Schema):
    datasets: list[DatasetOut]


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------


class PreviewRequest(Schema):
    selected_columns: list[str]
    filter: dict | None = None  # raw FilterGroup JSON
    limit: int = 100
    offset: int = 0


class PreviewResponse(Schema):
    columns: list[str]
    rows: list[dict]
    total: int | None = None

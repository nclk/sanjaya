"""Schemas for dataset and column endpoints."""

from __future__ import annotations

from sanjaya_core.enums import (
    AggFunc,
    ColumnType,
    FilterOperator,
    FilterStyle,
    FormatHintKind,
)

from sanjaya_django.schemas import CamelSchema


# ---------------------------------------------------------------------------
# Column metadata (mirrors sanjaya_core.types.ColumnMeta for the wire)
# ---------------------------------------------------------------------------


class CurrencyOptionsOut(CamelSchema):
    default_unit: str | None = None
    supported_units: list[str] | None = None
    default_magnitude: str | None = None
    supported_magnitudes: list[str] | None = None


class FormatHintsOut(CamelSchema):
    kind: FormatHintKind
    decimals: int | None = None
    currency_code: str | None = None
    currency_code_column: str | None = None


class PivotAggOptionOut(CamelSchema):
    agg: AggFunc
    label: str


class ColumnPivotOptionsOut(CamelSchema):
    role: str | None = None
    allowed_aggs: list[PivotAggOptionOut] | None = None


class ColumnOut(CamelSchema):
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


class ColumnsResponse(CamelSchema):
    columns: list[ColumnOut]


# ---------------------------------------------------------------------------
# Dataset listing
# ---------------------------------------------------------------------------


class DatasetCapabilitiesOut(CamelSchema):
    pivot: bool


class DatasetOut(CamelSchema):
    key: str
    label: str
    description: str
    capabilities: DatasetCapabilitiesOut


class DatasetsResponse(CamelSchema):
    datasets: list[DatasetOut]


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------


class PreviewRequest(CamelSchema):
    selected_columns: list[str]
    filter: dict | None = None  # raw FilterGroup JSON
    limit: int = 100
    offset: int = 0


class PreviewResponse(CamelSchema):
    columns: list[str]
    rows: list[dict]
    total: int | None = None

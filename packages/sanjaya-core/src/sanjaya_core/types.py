"""Pydantic models for column metadata, results, and aggregation specs.

These are the shared data structures that flow between the ``sanjaya`` Django
app and any :class:`~sanjaya_core.provider.DataProvider` implementation.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from sanjaya_core.enums import (
    AggFunc,
    ColumnType,
    FilterOperator,
    FilterStyle,
    FormatHintKind,
    SortDirection,
)


# ---------------------------------------------------------------------------
# Column metadata
# ---------------------------------------------------------------------------


class CurrencyOptions(BaseModel):
    """Currency-specific display options for a column."""

    default_unit: str | None = None
    supported_units: list[str] | None = None
    default_magnitude: str | None = None
    supported_magnitudes: list[str] | None = None


class FormatHints(BaseModel):
    """Structured formatting hints for cell rendering."""

    kind: FormatHintKind
    decimals: int | None = None
    currency_code: str | None = None
    currency_code_column: str | None = None


class PivotAggOption(BaseModel):
    """An allowed aggregate for a column used as a pivot measure."""

    agg: AggFunc
    label: str


class ColumnPivotOptions(BaseModel):
    """Pivot configuration hints for a dataset column."""

    role: str | None = None  # "dimension" | "measure"
    allowed_aggs: list[PivotAggOption] | None = None


class DatasetCapabilities(BaseModel):
    """Capability flags advertised by a dataset."""

    pivot: bool = False


class ColumnMeta(BaseModel):
    """Full metadata for a single dataset column.

    Returned by :meth:`DataProvider.get_columns` and used by the front end to
    build the report-builder UI (filter widgets, pivot drag zones, cell
    formatters, etc.).
    """

    name: str
    label: str
    type: ColumnType = ColumnType.STRING
    format: str | None = None
    enum_values: list[str] | None = None
    operators: list[FilterOperator] = Field(default_factory=list)
    nullable: bool = False
    currency: CurrencyOptions | None = None
    pivot: ColumnPivotOptions | None = None
    format_hints: FormatHints | None = None
    filter_style: FilterStyle | None = None


# ---------------------------------------------------------------------------
# Default operator presets
# ---------------------------------------------------------------------------

#: Common operators for text / string columns.
TEXT_OPERATORS: list[FilterOperator] = [
    FilterOperator.EQ,
    FilterOperator.NEQ,
    FilterOperator.CONTAINS,
    FilterOperator.STARTSWITH,
    FilterOperator.ENDSWITH,
    FilterOperator.IN,
    FilterOperator.IS_NULL,
    FilterOperator.IS_NOT_NULL,
]

#: Common operators for numeric columns (number, currency, percentage).
NUMBER_OPERATORS: list[FilterOperator] = [
    FilterOperator.EQ,
    FilterOperator.NEQ,
    FilterOperator.GT,
    FilterOperator.GTE,
    FilterOperator.LT,
    FilterOperator.LTE,
    FilterOperator.BETWEEN,
    FilterOperator.IN,
    FilterOperator.IS_NULL,
    FilterOperator.IS_NOT_NULL,
]

#: Common operators for date and datetime columns.
DATE_OPERATORS: list[FilterOperator] = [
    FilterOperator.EQ,
    FilterOperator.NEQ,
    FilterOperator.GT,
    FilterOperator.GTE,
    FilterOperator.LT,
    FilterOperator.LTE,
    FilterOperator.BETWEEN,
    FilterOperator.IS_NULL,
    FilterOperator.IS_NOT_NULL,
]

#: Common operators for boolean columns.
BOOLEAN_OPERATORS: list[FilterOperator] = [
    FilterOperator.EQ,
    FilterOperator.NEQ,
    FilterOperator.IS_NULL,
    FilterOperator.IS_NOT_NULL,
]


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


class SortSpec(BaseModel):
    """A single sort directive."""

    column: str
    direction: SortDirection = SortDirection.ASC


class ValueSpec(BaseModel):
    """A measure column + aggregate function for aggregation queries."""

    column: str
    agg: AggFunc
    label: str | None = None


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------


class TabularResult(BaseModel):
    """Result of a flat (non-pivot) query."""

    columns: list[str]
    rows: list[dict[str, Any]]
    total: int | None = None


class AggregateColumn(BaseModel):
    """Metadata for a single column in an :class:`AggregateResult`.

    For non-pivot aggregations the ``pivot_keys`` list is empty.  For pivot
    aggregations it contains the ordered dimension values that identify the
    column (e.g. ``["2024", "Q1"]``).
    """

    key: str
    header: str
    type: ColumnType | None = None
    pivot_keys: list[str] = Field(default_factory=list)
    measure: str | None = None
    agg: AggFunc | None = None


class AggregateResult(BaseModel):
    """Result of an aggregation (grouped / pivot) query.

    ``rows`` contains flat dicts keyed by :attr:`AggregateColumn.key`.
    The ``columns`` list describes the dynamic column set so the caller
    can reconstruct headers.
    """

    columns: list[AggregateColumn]
    rows: list[dict[str, Any]]
    total: int | None = None

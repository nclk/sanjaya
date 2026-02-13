"""sanjaya-core — shared types and data-provider interface."""

__version__ = "1.0.0"

from sanjaya_core.enums import (
    AggFunc,
    ColumnType,
    ExportFormat,
    FilterCombinator,
    FilterOperator,
    FilterStyle,
    FormatHintKind,
    SortDirection,
)
from sanjaya_core.types import (
    AggregateColumn,
    AggregateResult,
    BOOLEAN_OPERATORS,
    ColumnMeta,
    ColumnPivotOptions,
    CurrencyOptions,
    DATE_OPERATORS,
    DatasetCapabilities,
    FormatHints,
    NUMBER_OPERATORS,
    PivotAggOption,
    SortSpec,
    TabularResult,
    TEXT_OPERATORS,
    ValueSpec,
)
from sanjaya_core.filters import FilterCondition, FilterGroup
from sanjaya_core.context import RequestContext
from sanjaya_core.exceptions import (
    ProviderError,
    DatasetNotFoundError,
    ColumnNotFoundError,
    FilterValidationError,
    AggregationNotSupportedError,
)
from sanjaya_core.provider import DataProvider

__all__ = [
    # enums
    "AggFunc",
    "ColumnType",
    "ExportFormat",
    "FilterCombinator",
    "FilterOperator",
    "FilterStyle",
    "FormatHintKind",
    "SortDirection",
    # types
    "AggregateColumn",
    "AggregateResult",
    "BOOLEAN_OPERATORS",
    "ColumnMeta",
    "ColumnPivotOptions",
    "CurrencyOptions",
    "DATE_OPERATORS",
    "DatasetCapabilities",
    "FormatHints",
    "NUMBER_OPERATORS",
    "PivotAggOption",
    "SortSpec",
    "TabularResult",
    "TEXT_OPERATORS",
    "ValueSpec",
    # filters
    "FilterCondition",
    "FilterGroup",
    # context
    "RequestContext",
    # exceptions
    "ProviderError",
    "DatasetNotFoundError",
    "ColumnNotFoundError",
    "FilterValidationError",
    "AggregationNotSupportedError",
    # provider
    "DataProvider",
]

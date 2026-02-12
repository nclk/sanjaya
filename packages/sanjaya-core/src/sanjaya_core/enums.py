"""Enumerations shared across the Sanjaya reporting platform.

These mirror the TypeSpec enums in ``api/models/dynamic-reports.tsp`` and are
the single source of truth on the Python side.
"""

from enum import StrEnum


class ColumnType(StrEnum):
    """Data types a dataset column can have."""

    STRING = "string"
    NUMBER = "number"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"


class FilterOperator(StrEnum):
    """Operators available inside a :class:`FilterCondition`."""

    EQ = "eq"
    NEQ = "neq"
    GT = "gt"
    LT = "lt"
    GTE = "gte"
    LTE = "lte"
    CONTAINS = "contains"
    STARTSWITH = "startswith"
    ENDSWITH = "endswith"
    IS_NULL = "isNull"
    IS_NOT_NULL = "isNotNull"
    BETWEEN = "between"
    IN = "in"


class FilterCombinator(StrEnum):
    """Logical combinator for :class:`FilterGroup`."""

    AND = "and"
    OR = "or"


class FilterStyle(StrEnum):
    """UI hint for how a column should be filtered."""

    OPERATORS = "operators"
    SELECT = "select"


class ExportFormat(StrEnum):
    """Supported export output formats."""

    CSV = "csv"
    XLSX = "xlsx"


class AggFunc(StrEnum):
    """Aggregate functions for pivot measures.

    Values align with AG Grid ``aggFunc`` strings.
    """

    SUM = "sum"
    AVG = "avg"
    MIN = "min"
    MAX = "max"
    COUNT = "count"
    DISTINCT_COUNT = "distinctCount"
    FIRST = "first"
    LAST = "last"


class FormatHintKind(StrEnum):
    """Business-oriented format kinds for cell rendering."""

    STRING = "string"
    NUMBER = "number"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"
    BASIS_POINTS = "basis_points"


class SortDirection(StrEnum):
    """Sort direction."""

    ASC = "asc"
    DESC = "desc"

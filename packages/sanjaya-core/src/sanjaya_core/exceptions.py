"""Exception hierarchy for data providers."""


class ProviderError(Exception):
    """Base class for all provider-related errors."""

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.code = code


class DatasetNotFoundError(ProviderError):
    """Raised when a requested dataset key does not exist in the registry."""

    def __init__(self, dataset_key: str) -> None:
        super().__init__(
            f"Dataset not found: {dataset_key!r}",
            code="dataset_not_found",
        )
        self.dataset_key = dataset_key


class ColumnNotFoundError(ProviderError):
    """Raised when a requested column does not exist in the dataset."""

    def __init__(self, column: str, dataset_key: str | None = None) -> None:
        detail = f"Column not found: {column!r}"
        if dataset_key:
            detail += f" in dataset {dataset_key!r}"
        super().__init__(detail, code="column_not_found")
        self.column = column
        self.dataset_key = dataset_key


class FilterValidationError(ProviderError):
    """Raised when a filter group / condition is structurally invalid."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="filter_validation_error")


class AggregationNotSupportedError(ProviderError):
    """Raised when a provider does not support the requested aggregation."""

    def __init__(self, message: str = "Aggregation not supported") -> None:
        super().__init__(message, code="aggregation_not_supported")

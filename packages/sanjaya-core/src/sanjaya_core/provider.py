"""Abstract base class for Sanjaya data providers.

A *data provider* is responsible for:

1. Declaring the columns (schema) of a dataset.
2. Executing flat queries with filtering, sorting, and pagination.
3. Executing aggregation queries (GROUP BY / pivot) with filtering, sorting,
   and pagination.

Providers must **not** depend on Django.  They receive a
:class:`~sanjaya_core.context.RequestContext` if the host project chooses to
pass one, but must work without it.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from sanjaya_core.context import RequestContext
from sanjaya_core.filters import FilterGroup
from sanjaya_core.types import (
    AggregateResult,
    ColumnMeta,
    DatasetCapabilities,
    SortSpec,
    TabularResult,
    ValueSpec,
)


class DataProvider(ABC):
    """Interface that every data-provider package must implement.

    Attributes
    ----------
    key:
        Unique identifier for this dataset (e.g. ``"trade_activity"``).
    label:
        Human-readable name shown in the UI.
    description:
        Longer description of what the dataset contains.
    capabilities:
        Feature flags (currently just ``pivot``).
    """

    key: str
    label: str
    description: str
    capabilities: DatasetCapabilities

    def __init__(
        self,
        *,
        key: str,
        label: str,
        description: str = "",
        capabilities: DatasetCapabilities | None = None,
    ) -> None:
        self.key = key
        self.label = label
        self.description = description
        self.capabilities = capabilities or DatasetCapabilities()

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    def get_columns(self) -> list[ColumnMeta]:
        """Return column metadata for this dataset."""
        ...

    @abstractmethod
    def query(
        self,
        selected_columns: list[str],
        *,
        filter_group: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int = 100,
        offset: int = 0,
        ctx: RequestContext | None = None,
    ) -> TabularResult:
        """Execute a flat (non-pivot) query and return rows.

        Parameters
        ----------
        selected_columns:
            Column names to include in the result (projection / pushdown).
        filter_group:
            Optional recursive filter tree.
        sort:
            Optional list of sort directives.
        limit:
            Maximum rows to return.
        offset:
            Number of rows to skip (for pagination).
        ctx:
            Optional request context for row-level security.
        """
        ...

    @abstractmethod
    def aggregate(
        self,
        group_by_rows: list[str],
        group_by_cols: list[str],
        values: list[ValueSpec],
        *,
        filter_group: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int = 0,
        ctx: RequestContext | None = None,
    ) -> AggregateResult:
        """Execute an aggregation (GROUP BY / pivot) query.

        Parameters
        ----------
        group_by_rows:
            Column names for the row axis (row groups).
        group_by_cols:
            Column names for the column axis (pivot dimensions).  Empty list
            for a simple GROUP BY without pivoting.
        values:
            Measure columns with their aggregate functions.
        filter_group:
            Optional recursive filter tree.
        sort:
            Optional sort directives (applied to the grouped result).
        limit:
            Maximum groups / rows to return (``None`` = all).
        offset:
            Number of groups to skip.
        ctx:
            Optional request context for row-level security.
        """
        ...

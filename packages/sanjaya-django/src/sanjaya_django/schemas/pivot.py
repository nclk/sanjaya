"""Schemas for the AG Grid SSRM pivot endpoint."""

from __future__ import annotations

from sanjaya_django.schemas.ssrm import (
    ColumnVO,
    PivotResultColDef,
    SSRMBaseRequest,
    ServerSideGetRowsResponse,
    SortModelItem,
)

# Re-export shared types so existing imports still work.
__all__ = [
    "ColumnVO",
    "PivotResultColDef",
    "ServerSideGetRowsRequest",
    "ServerSideGetRowsResponse",
    "SortModelItem",
]


class ServerSideGetRowsRequest(SSRMBaseRequest):
    """AG Grid SSRM request for the pivot endpoint.

    Extends the shared base with pivot-specific fields.
    """

    pivot_cols: list[ColumnVO]
    pivot_mode: bool

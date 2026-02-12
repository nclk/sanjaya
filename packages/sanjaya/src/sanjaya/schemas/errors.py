"""Error envelope schemas matching the TypeSpec error models."""

from __future__ import annotations

from ninja import Schema


class ErrorDetail(Schema):
    error_type: str
    message: str
    field: str | None = None
    path: list | None = None
    location: str | None = None


class CustomErrorResponse(Schema):
    error: str = "custom_error"
    details: list[ErrorDetail]


class PermissionErrorResponse(Schema):
    error: str = "permission_error"
    details: list[ErrorDetail]


# ---------------------------------------------------------------------------
# Helpers to build error payloads
# ---------------------------------------------------------------------------


def make_error(
    message: str,
    *,
    error_type: str = "error",
    field: str | None = None,
) -> CustomErrorResponse:
    return CustomErrorResponse(
        details=[ErrorDetail(error_type=error_type, message=message, field=field)]
    )


def make_not_found(entity: str, key: str) -> CustomErrorResponse:
    return CustomErrorResponse(
        error="custom_error",
        details=[
            ErrorDetail(
                error_type="not_found",
                message=f"{entity} not found: {key!r}",
            )
        ],
    )


def make_permission_error(message: str = "Permission denied") -> PermissionErrorResponse:
    return PermissionErrorResponse(
        details=[ErrorDetail(error_type="permission_error", message=message)]
    )

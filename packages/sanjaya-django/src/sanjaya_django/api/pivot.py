"""AG Grid SSRM pivot endpoint."""

from __future__ import annotations

from ninja import Router

from sanjaya_core.context import RequestContext
from sanjaya_core.exceptions import (
    AggregationNotSupportedError,
    DatasetNotFoundError,
)

from sanjaya_django.registry import registry
from sanjaya_django.schemas.errors import CustomErrorResponse, ErrorDetail, make_not_found
from sanjaya_django.schemas.pivot import (
    ServerSideGetRowsRequest,
    ServerSideGetRowsResponse,
)
from sanjaya_django.services.pivot import handle_ssrm_request

router = Router(tags=["pivot"])


@router.post(
    "/{dataset_key}/pivot",
    response={
        200: ServerSideGetRowsResponse,
        400: CustomErrorResponse,
        401: CustomErrorResponse,
        404: CustomErrorResponse,
        501: CustomErrorResponse,
    },
    url_name="sanjaya-dataset-pivot",
)
def pivot(request, dataset_key: str, body: ServerSideGetRowsRequest):
    if not (request.user and request.user.is_authenticated):
        return 401, CustomErrorResponse(
            details=[ErrorDetail(error_type="auth", message="Authentication required")]
        )

    try:
        provider = registry.get(dataset_key)
    except DatasetNotFoundError:
        return 404, make_not_found("Dataset", dataset_key)

    if body.pivot_mode and not provider.capabilities.pivot:
        return 501, CustomErrorResponse(
            details=[
                ErrorDetail(
                    error_type="not_supported",
                    message=f"Dataset {dataset_key!r} does not support pivoting",
                )
            ]
        )

    ctx = RequestContext(
        user_id=str(request.user.pk) if request.user.pk else None,
    )

    try:
        response = handle_ssrm_request(provider, body, ctx=ctx)
    except AggregationNotSupportedError as exc:
        return 501, CustomErrorResponse(
            details=[ErrorDetail(error_type="not_supported", message=str(exc))]
        )
    except Exception as exc:
        return 400, CustomErrorResponse(
            details=[ErrorDetail(error_type="error", message=str(exc))]
        )

    return 200, response

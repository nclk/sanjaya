"""AG Grid SSRM table endpoint — flat data, row grouping, aggregation (no pivot)."""

from __future__ import annotations

from ninja import Router

from sanjaya_core.context import RequestContext
from sanjaya_core.exceptions import (
    AggregationNotSupportedError,
    DatasetNotFoundError,
)

from sanjaya_django.registry import registry
from sanjaya_django.schemas.errors import CustomErrorResponse, ErrorDetail, make_not_found
from sanjaya_django.schemas.ssrm import (
    ServerSideGetRowsResponse,
    TableGetRowsRequest,
)
from sanjaya_django.services.ssrm import handle_table_ssrm_request

router = Router(tags=["table"], by_alias=True)


@router.post(
    "/{dataset_key}/table/",
    response={
        200: ServerSideGetRowsResponse,
        400: CustomErrorResponse,
        401: CustomErrorResponse,
        404: CustomErrorResponse,
    },
    url_name="sanjaya-dataset-table",
)
def table(request, dataset_key: str, body: TableGetRowsRequest):
    if not (request.user and request.user.is_authenticated):
        return 401, CustomErrorResponse(
            details=[ErrorDetail(error_type="auth", message="Authentication required")]
        )

    try:
        provider = registry.get(dataset_key)
    except DatasetNotFoundError:
        return 404, make_not_found("Dataset", dataset_key)

    ctx = RequestContext(
        user_id=str(request.user.pk) if request.user.pk else None,
    )

    try:
        response = handle_table_ssrm_request(provider, body, ctx=ctx)
    except AggregationNotSupportedError as exc:
        return 400, CustomErrorResponse(
            details=[ErrorDetail(error_type="not_supported", message=str(exc))]
        )
    except Exception as exc:
        return 400, CustomErrorResponse(
            details=[ErrorDetail(error_type="error", message=str(exc))]
        )

    return 200, response

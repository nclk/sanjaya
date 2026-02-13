"""Dataset discovery, column metadata, and preview endpoints."""

from __future__ import annotations

from ninja import Router

from sanjaya_core.context import RequestContext
from sanjaya_core.exceptions import DatasetNotFoundError

from sanjaya_django.registry import registry
from sanjaya_django.schemas.datasets import (
    ColumnsResponse,
    ColumnOut,
    DatasetCapabilitiesOut,
    DatasetOut,
    DatasetsResponse,
    PreviewRequest,
    PreviewResponse,
)
from sanjaya_django.schemas.errors import CustomErrorResponse, ErrorDetail, make_not_found
from sanjaya_django.schemas.filters import parse_filter_group

router = Router(tags=["datasets"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_auth(request) -> bool:
    return (
        request.user is not None
        and hasattr(request.user, "is_authenticated")
        and request.user.is_authenticated
    )


def _build_ctx(request) -> RequestContext:
    user = request.user
    return RequestContext(
        user_id=str(user.pk) if user and user.pk else None,
        groups=[g.name for g in user.groups.all()] if user else [],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/",
    response={200: DatasetsResponse, 401: CustomErrorResponse},
    url_name="sanjaya-datasets-list",
)
def list_datasets(request):
    if not _require_auth(request):
        return 401, CustomErrorResponse(
            details=[ErrorDetail(error_type="auth", message="Authentication required")]
        )
    providers = registry.all_providers()
    datasets = [
        DatasetOut(
            key=p.key,
            label=p.label,
            description=p.description,
            capabilities=DatasetCapabilitiesOut(pivot=p.capabilities.pivot),
        )
        for p in providers
    ]
    return 200, DatasetsResponse(datasets=datasets)


@router.get(
    "/{dataset_key}/columns",
    response={200: ColumnsResponse, 401: CustomErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-dataset-columns",
)
def get_columns(request, dataset_key: str):
    if not _require_auth(request):
        return 401, CustomErrorResponse(
            details=[ErrorDetail(error_type="auth", message="Authentication required")]
        )
    try:
        provider = registry.get(dataset_key)
    except DatasetNotFoundError:
        return 404, make_not_found("Dataset", dataset_key)

    core_columns = provider.get_columns()
    columns = [ColumnOut(**c.model_dump()) for c in core_columns]
    return 200, ColumnsResponse(columns=columns)


@router.post(
    "/{dataset_key}/preview",
    response={200: PreviewResponse, 400: CustomErrorResponse, 401: CustomErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-dataset-preview",
)
def preview(request, dataset_key: str, body: PreviewRequest):
    if not _require_auth(request):
        return 401, CustomErrorResponse(
            details=[ErrorDetail(error_type="auth", message="Authentication required")]
        )
    try:
        provider = registry.get(dataset_key)
    except DatasetNotFoundError:
        return 404, make_not_found("Dataset", dataset_key)

    try:
        filter_group = parse_filter_group(body.filter)
    except Exception as exc:
        return 400, CustomErrorResponse(
            details=[ErrorDetail(error_type="filter_error", message=str(exc))]
        )

    ctx = _build_ctx(request)
    result = provider.query(
        body.selected_columns,
        filter_group=filter_group,
        limit=body.limit,
        offset=body.offset,
        ctx=ctx,
    )
    return 200, PreviewResponse(
        columns=result.columns,
        rows=result.rows,
        total=result.total,
    )

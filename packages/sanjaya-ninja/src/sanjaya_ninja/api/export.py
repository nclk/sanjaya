"""Export endpoint — CSV / XLSX for flat and pivot data."""

from __future__ import annotations

from ninja import Router

from sanjaya_core.context import RequestContext
from sanjaya_core.exceptions import DatasetNotFoundError

from sanjaya_ninja.registry import registry
from sanjaya_ninja.schemas.errors import CustomErrorResponse, ErrorDetail, make_not_found
from sanjaya_ninja.schemas.export import ExportRequest
from sanjaya_ninja.services.export import handle_export

router = Router(tags=["export"])


@router.post(
    "/{dataset_key}/export",
    response={400: CustomErrorResponse, 401: CustomErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-dataset-export",
)
def export(request, dataset_key: str, body: ExportRequest):
    if not (request.user and request.user.is_authenticated):
        return 401, CustomErrorResponse(
            details=[ErrorDetail(error_type="auth", message="Authentication required")]
        )

    try:
        provider = registry.get(dataset_key)
    except DatasetNotFoundError:
        return 404, make_not_found("Dataset", dataset_key)

    if body.flat is None and body.pivot is None:
        return 400, CustomErrorResponse(
            details=[
                ErrorDetail(
                    error_type="validation_error",
                    message="Must specify either 'flat' or 'pivot' export parameters.",
                )
            ]
        )

    ctx = RequestContext(
        user_id=str(request.user.pk) if request.user.pk else None,
    )

    try:
        return handle_export(provider, body, ctx=ctx)
    except Exception as exc:
        return 400, CustomErrorResponse(
            details=[ErrorDetail(error_type="error", message=str(exc))]
        )

"""Saved-report CRUD, lifecycle actions, and sharing endpoints."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.shortcuts import get_object_or_404
from ninja import Router

from sanjaya_django.models import (
    DynamicReport,
    DynamicReportFavorite,
    DynamicReportGroupShare,
    DynamicReportUserShare,
    Permission,
)
from sanjaya_django.schemas.errors import (
    CustomErrorResponse,
    ErrorDetail,
    PermissionErrorResponse,
    make_error,
    make_not_found,
    make_permission_error,
)
from sanjaya_django.schemas.reports import (
    ActionResponse,
    CreateDynamicReportRequest,
    DeleteGroupShareRequest,
    DeleteUserShareRequest,
    DynamicReportOut,
    DynamicReportStatsOut,
    DynamicReportSummaryOut,
    GroupShareOut,
    ListDynamicReportsResponse,
    ListSharesResponse,
    PerformActionRequest,
    UpdateDynamicReportRequest,
    UpsertGroupShareRequest,
    UpsertUserShareRequest,
    UserShareOut,
)
from sanjaya_django.services.reports import (
    can_edit,
    can_view,
    compute_available_actions,
    is_owner,
    perform_action,
    resolve_effective_permission,
    user_ref,
)

router = Router(tags=["reports"], by_alias=True)
User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _report_out(report: DynamicReport, user) -> DynamicReportOut:
    return DynamicReportOut(
        id=report.pk,
        title=report.title,
        description=report.description,
        status=report.status,
        created_by=user_ref(report.created_by),
        created_at=report.created_at,
        updated_by=user_ref(report.updated_by) if report.updated_by else None,
        updated_at=report.updated_at,
        published_at=report.published_at,
        published_by=user_ref(report.published_by) if report.published_by else None,
        archived_at=report.archived_at,
        version=report.version,
        tags=report.tags or [],
        available_actions=compute_available_actions(report, user),
        metadata=report.metadata,
        is_favorited=DynamicReportFavorite.objects.filter(
            report=report, user=user,
        ).exists(),
    )


def _summary_out(report: DynamicReport, user) -> DynamicReportSummaryOut:
    return DynamicReportSummaryOut(
        id=report.pk,
        title=report.title,
        status=report.status,
        created_by=user_ref(report.created_by),
        updated_at=report.updated_at,
        version=report.version,
        available_actions=compute_available_actions(report, user),
        metadata=report.metadata,
        is_favorited=DynamicReportFavorite.objects.filter(
            report=report, user=user,
        ).exists(),
    )


def _require_auth(request):
    if not (request.user and request.user.is_authenticated):
        return CustomErrorResponse(
            details=[ErrorDetail(error_type="auth", message="Authentication required")]
        )
    return None


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/",
    response={200: ListDynamicReportsResponse, 401: CustomErrorResponse},
    url_name="sanjaya-reports-list",
)
def list_reports(
    request,
    status: str | None = None,
    search: str | None = None,
    favorited: bool | None = None,
    limit: int = 25,
    offset: int = 0,
    sort_by: str = "updatedAt",
    sort_order: str = "desc",
):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    user = request.user
    qs = DynamicReport.objects.select_related("created_by")

    # Filter to reports the user can see.
    if not user.is_superuser and not user.has_perm("sanjaya_django.can_view_any"):
        user_group_ids = user.groups.values_list("pk", flat=True)
        qs = qs.filter(
            models_Q_visible(user, user_group_ids)
        )

    if status:
        qs = qs.filter(status=status)
    if search:
        qs = qs.filter(title__icontains=search)
    if favorited:
        qs = qs.filter(favorites__user=user)

    sort_field_map = {
        "title": "title",
        "createdAt": "created_at",
        "updatedAt": "updated_at",
        "status": "status",
    }
    db_sort = sort_field_map.get(sort_by, "updated_at")
    if sort_order == "desc":
        db_sort = f"-{db_sort}"
    qs = qs.order_by(db_sort)

    total = qs.count()
    reports = list(qs[offset : offset + limit])

    return 200, ListDynamicReportsResponse(
        reports=[_summary_out(r, user) for r in reports],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/",
    response={201: DynamicReportOut, 401: CustomErrorResponse},
    url_name="sanjaya-reports-create",
)
def create_report(request, body: CreateDynamicReportRequest):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.create(
        title=body.title,
        description=body.description,
        tags=body.tags,
        metadata=body.metadata or {},
        created_by=request.user,
    )
    return 201, _report_out(report, request.user)


# ---------------------------------------------------------------------------
# Stats  (before /{report_id} so "stats" is not parsed as an int)
# ---------------------------------------------------------------------------


@router.get(
    "/stats",
    response={200: DynamicReportStatsOut, 401: CustomErrorResponse},
    url_name="sanjaya-reports-stats",
)
def stats(request):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    from django.db.models import Count, Q

    agg = DynamicReport.objects.aggregate(
        total=Count("pk"),
        drafts=Count("pk", filter=Q(status="draft")),
        published=Count("pk", filter=Q(status="published")),
        archived=Count("pk", filter=Q(status="archived")),
    )
    return 200, DynamicReportStatsOut(
        total=agg["total"],
        drafts=agg["drafts"],
        published=agg["published"],
        archived=agg["archived"],
        by_type={},
    )


@router.get(
    "/{report_id}",
    response={200: DynamicReportOut, 401: CustomErrorResponse, 403: PermissionErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-reports-detail",
)
def get_report(request, report_id: int):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.select_related(
        "created_by", "updated_by", "published_by"
    ).filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))
    if not can_view(report, request.user):
        return 403, make_permission_error()
    return 200, _report_out(report, request.user)


@router.patch(
    "/{report_id}",
    response={200: DynamicReportOut, 401: CustomErrorResponse, 403: PermissionErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-reports-update",
)
def update_report(request, report_id: int, body: UpdateDynamicReportRequest):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))
    if not can_edit(report, request.user):
        return 403, make_permission_error()

    update_fields = []
    if body.title is not None:
        report.title = body.title
        update_fields.append("title")
    if body.description is not None:
        report.description = body.description
        update_fields.append("description")
    if body.tags is not None:
        report.tags = body.tags
        update_fields.append("tags")
    if body.metadata is not None:
        report.metadata = body.metadata
        update_fields.append("metadata")

    if update_fields:
        report.updated_by = request.user
        report.version += 1
        update_fields.extend(["updated_by", "version", "updated_at"])
        report.save(update_fields=update_fields)

    return 200, _report_out(report, request.user)


# ---------------------------------------------------------------------------
# Lifecycle actions
# ---------------------------------------------------------------------------


@router.get(
    "/{report_id}/actions",
    response={200: dict, 401: CustomErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-reports-actions-list",
)
def list_actions(request, report_id: int):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))

    actions = compute_available_actions(report, request.user)
    return 200, {"actions": actions}


@router.post(
    "/{report_id}/actions",
    response={
        200: ActionResponse,
        400: CustomErrorResponse,
        401: CustomErrorResponse,
        403: PermissionErrorResponse,
        404: CustomErrorResponse,
    },
    url_name="sanjaya-reports-actions-perform",
)
def perform_report_action(request, report_id: int, body: PerformActionRequest):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.select_related(
        "created_by", "updated_by", "published_by"
    ).filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))

    available = compute_available_actions(report, request.user)
    if body.action not in available:
        return 403, make_permission_error(
            f"Action {body.action!r} not available on this report."
        )

    try:
        report, message = perform_action(
            report,
            body.action,
            request.user,
            reason=body.reason,
            target_user_id=body.target_user_id,
        )
    except ValueError as exc:
        return 400, make_error(str(exc))

    if body.action == "delete":
        return 200, ActionResponse(report=None, message=message)

    return 200, ActionResponse(
        report=_report_out(report, request.user),
        message=message,
    )


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------


@router.get(
    "/{report_id}/shares",
    response={200: ListSharesResponse, 401: CustomErrorResponse, 403: PermissionErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-reports-shares-list",
)
def list_shares(request, report_id: int):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))
    if not is_owner(report, request.user) and not request.user.has_perm("sanjaya_django.can_manage_shares_any"):
        return 403, make_permission_error()

    return 200, _shares_response(report)


@router.post(
    "/{report_id}/shares/users",
    response={200: ListSharesResponse, 401: CustomErrorResponse, 403: PermissionErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-reports-shares-users-upsert",
)
def upsert_user_share(request, report_id: int, body: UpsertUserShareRequest):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))
    if not is_owner(report, request.user) and not request.user.has_perm("sanjaya_django.can_manage_shares_any"):
        return 403, make_permission_error()

    target_user = User.objects.filter(pk=body.user_id).first()
    if not target_user:
        return 404, make_not_found("User", body.user_id)

    DynamicReportUserShare.objects.update_or_create(
        report=report,
        user=target_user,
        defaults={"permission": body.permission},
    )
    return 200, _shares_response(report)


@router.delete(
    "/{report_id}/shares/users",
    response={200: ListSharesResponse, 401: CustomErrorResponse, 403: PermissionErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-reports-shares-users-delete",
)
def delete_user_share(request, report_id: int, body: DeleteUserShareRequest):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))
    if not is_owner(report, request.user) and not request.user.has_perm("sanjaya_django.can_manage_shares_any"):
        return 403, make_permission_error()

    DynamicReportUserShare.objects.filter(
        report=report, user_id=body.user_id
    ).delete()
    return 200, _shares_response(report)


@router.post(
    "/{report_id}/shares/groups",
    response={200: ListSharesResponse, 401: CustomErrorResponse, 403: PermissionErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-reports-shares-groups-upsert",
)
def upsert_group_share(request, report_id: int, body: UpsertGroupShareRequest):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))
    if not is_owner(report, request.user) and not request.user.has_perm("sanjaya_django.can_manage_shares_any"):
        return 403, make_permission_error()

    group = Group.objects.filter(pk=body.group_id).first()
    if not group:
        return 404, make_not_found("Group", body.group_id)

    DynamicReportGroupShare.objects.update_or_create(
        report=report,
        group=group,
        defaults={"permission": body.permission},
    )
    return 200, _shares_response(report)


@router.delete(
    "/{report_id}/shares/groups",
    response={200: ListSharesResponse, 401: CustomErrorResponse, 403: PermissionErrorResponse, 404: CustomErrorResponse},
    url_name="sanjaya-reports-shares-groups-delete",
)
def delete_group_share(request, report_id: int, body: DeleteGroupShareRequest):
    auth_err = _require_auth(request)
    if auth_err:
        return 401, auth_err

    report = DynamicReport.objects.filter(pk=report_id).first()
    if not report:
        return 404, make_not_found("Report", str(report_id))
    if not is_owner(report, request.user) and not request.user.has_perm("sanjaya_django.can_manage_shares_any"):
        return 403, make_permission_error()

    DynamicReportGroupShare.objects.filter(
        report=report, group_id=body.group_id
    ).delete()
    return 200, _shares_response(report)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _shares_response(report: DynamicReport) -> ListSharesResponse:
    user_shares = DynamicReportUserShare.objects.select_related("user").filter(
        report=report
    )
    group_shares = DynamicReportGroupShare.objects.select_related("group").filter(
        report=report
    )
    return ListSharesResponse(
        users=[
            UserShareOut(user=user_ref(s.user), permission=s.permission)
            for s in user_shares
        ],
        groups=[
            GroupShareOut(
                group_id=str(s.group_id),  # type: ignore[attr-defined]
                group_name=s.group.name,
                permission=s.permission,
            )
            for s in group_shares
        ],
    )


def models_Q_visible(user, user_group_ids):
    """Build a Q filter for reports the user can see."""
    from django.db.models import Q

    return (
        Q(created_by=user)
        | Q(user_shares__user=user)
        | Q(group_shares__group_id__in=user_group_ids)
    )

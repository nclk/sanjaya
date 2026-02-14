"""Report lifecycle, permission resolution, and action handling."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from django.contrib.auth.models import AbstractUser, Group
from django.db.models import Q

from sanjaya_django.models import (
    DynamicReport,
    DynamicReportFavorite,
    DynamicReportGroupShare,
    DynamicReportUserShare,
    Permission,
)
from sanjaya_django.schemas.reports import UserReferenceOut


# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------


def _has_perm(user: AbstractUser, codename: str) -> bool:
    return bool(user.is_superuser) or user.has_perm(f"sanjaya_django.{codename}")


def resolve_effective_permission(
    report: DynamicReport, user: AbstractUser
) -> str | None:
    """Return the effective permission for *user* on *report*.

    Resolution order:
    1. Owner (``report.created_by == user``) → ``"owner"``
    2. Global ``can_view_any`` perm → ``"viewer"``
    3. Explicit user share
    4. Group share (highest permission wins)
    5. ``None`` → no access
    """
    if report.created_by_id == user.pk:  # type: ignore[attr-defined]
        return Permission.OWNER

    # Global perms
    if _has_perm(user, "can_edit_any"):
        return Permission.EDITOR
    if _has_perm(user, "can_view_any"):
        return Permission.VIEWER

    # Direct user share
    user_share = (
        DynamicReportUserShare.objects.filter(report=report, user=user)
        .values_list("permission", flat=True)
        .first()
    )
    if user_share:
        return user_share

    # Group shares
    user_group_ids = user.groups.values_list("pk", flat=True)
    group_perms = list(
        DynamicReportGroupShare.objects.filter(
            report=report, group_id__in=user_group_ids
        ).values_list("permission", flat=True)
    )
    if group_perms:
        prio = {Permission.OWNER: 3, Permission.EDITOR: 2, Permission.VIEWER: 1}
        return max(group_perms, key=lambda p: prio.get(p, 0))

    return None


def can_view(report: DynamicReport, user: AbstractUser) -> bool:
    return resolve_effective_permission(report, user) is not None


def can_edit(report: DynamicReport, user: AbstractUser) -> bool:
    perm = resolve_effective_permission(report, user)
    return perm in (Permission.EDITOR, Permission.OWNER)


def is_owner(report: DynamicReport, user: AbstractUser) -> bool:
    return resolve_effective_permission(report, user) == Permission.OWNER


# ---------------------------------------------------------------------------
# Available actions
# ---------------------------------------------------------------------------


def compute_available_actions(
    report: DynamicReport, user: AbstractUser
) -> list[str]:
    """Return the list of action strings the user can perform."""
    perm = resolve_effective_permission(report, user)
    if perm is None:
        return []

    actions: list[str] = []
    status = report.status

    if perm in (Permission.EDITOR, Permission.OWNER):
        actions.append("edit")

    if status == DynamicReport.Status.DRAFT:
        if perm == Permission.OWNER or _has_perm(user, "publish_any"):
            actions.append("publish")
    elif status == DynamicReport.Status.PUBLISHED:
        if perm == Permission.OWNER or _has_perm(user, "publish_any"):
            actions.append("unpublish")
        if perm == Permission.OWNER or _has_perm(user, "publish_any"):
            actions.append("archive")
    elif status == DynamicReport.Status.ARCHIVED:
        if perm == Permission.OWNER or _has_perm(user, "publish_any"):
            actions.append("restore")

    if perm == Permission.OWNER or _has_perm(user, "can_manage_shares_any"):
        actions.append("share")

    if perm == Permission.OWNER or _has_perm(user, "can_transfer_ownership_any"):
        actions.append("transferOwnership")

    if perm == Permission.OWNER or _has_perm(user, "can_destroy_any"):
        actions.append("delete")

    # Any authenticated user with at least viewer access can favorite
    actions.append("favorite")

    return actions


# ---------------------------------------------------------------------------
# Action execution
# ---------------------------------------------------------------------------


def perform_action(
    report: DynamicReport,
    action: str,
    user: AbstractUser,
    *,
    reason: str | None = None,
    target_user_id: str | None = None,
) -> tuple[DynamicReport, str]:
    """Execute a lifecycle action, returning ``(report, message)``."""
    now = datetime.now(timezone.utc)

    match action:
        case "publish":
            report.status = DynamicReport.Status.PUBLISHED
            report.published_at = now
            report.published_by = user
            report.save(update_fields=["status", "published_at", "published_by", "updated_at"])
            return report, "Report published."

        case "unpublish":
            report.status = DynamicReport.Status.DRAFT
            report.published_at = None
            report.published_by = None
            report.save(update_fields=["status", "published_at", "published_by", "updated_at"])
            return report, "Report unpublished."

        case "archive":
            report.status = DynamicReport.Status.ARCHIVED
            report.archived_at = now
            report.save(update_fields=["status", "archived_at", "updated_at"])
            return report, "Report archived."

        case "restore":
            report.status = DynamicReport.Status.DRAFT
            report.archived_at = None
            report.save(update_fields=["status", "archived_at", "updated_at"])
            return report, "Report restored to draft."

        case "transferOwnership":
            if not target_user_id:
                raise ValueError("target_user_id is required for transferOwnership.")
            from django.contrib.auth import get_user_model
            UserModel = get_user_model()
            new_owner = UserModel.objects.filter(pk=target_user_id).first()
            if not new_owner:
                raise ValueError(f"Target user {target_user_id!r} not found.")
            report.created_by = new_owner
            report.save(update_fields=["created_by", "updated_at"])
            return report, f"Ownership transferred to {new_owner}."

        case "delete":
            report.delete()
            return report, "Report deleted."

        case "favorite":
            _, created = DynamicReportFavorite.objects.get_or_create(
                report=report, user=user,
            )
            if not created:
                DynamicReportFavorite.objects.filter(
                    report=report, user=user,
                ).delete()
                return report, "Report unfavorited."
            return report, "Report favorited."

        case _:
            raise ValueError(f"Unknown action: {action!r}")


# ---------------------------------------------------------------------------
# User reference builder
# ---------------------------------------------------------------------------


def user_ref(user: AbstractUser) -> UserReferenceOut:
    """Build a :class:`UserReferenceOut` from a Django user."""
    return UserReferenceOut(
        id=str(user.pk),
        name=getattr(user, "get_full_name", lambda: user.username)()
            or user.username,
        email=getattr(user, "email", None),
    )

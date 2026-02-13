"""Schemas for saved-report CRUD, lifecycle, and sharing endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from sanjaya_django.schemas import CamelSchema


# ---------------------------------------------------------------------------
# User reference (thin — host project owns the real model)
# ---------------------------------------------------------------------------


class UserReferenceOut(CamelSchema):
    id: str
    name: str
    email: str | None = None


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


class DynamicReportOut(CamelSchema):
    id: int
    title: str
    description: str
    status: str
    created_by: UserReferenceOut
    created_at: datetime
    updated_by: UserReferenceOut | None = None
    updated_at: datetime | None = None
    published_at: datetime | None = None
    published_by: UserReferenceOut | None = None
    archived_at: datetime | None = None
    version: int
    tags: list[str]
    available_actions: list[str]
    metadata: dict | None = None


class DynamicReportSummaryOut(CamelSchema):
    id: int
    title: str
    status: str
    created_by: UserReferenceOut
    updated_at: datetime | None = None
    version: int
    available_actions: list[str]
    metadata: dict | None = None


class ListDynamicReportsResponse(CamelSchema):
    reports: list[DynamicReportSummaryOut]
    total: int
    limit: int
    offset: int


class CreateDynamicReportRequest(CamelSchema):
    title: str
    description: str = ""
    tags: list[str] = []
    metadata: dict | None = None


class UpdateDynamicReportRequest(CamelSchema):
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    metadata: dict | None = None


class PerformActionRequest(CamelSchema):
    action: str
    reason: str | None = None
    target_user_id: str | None = None


class ActionResponse(CamelSchema):
    report: DynamicReportOut | None = None
    message: str


class DynamicReportStatsOut(CamelSchema):
    total: int
    drafts: int
    published: int
    archived: int
    by_type: dict[str, int]


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------


class UserShareOut(CamelSchema):
    user: UserReferenceOut
    permission: str


class GroupShareOut(CamelSchema):
    group_id: str
    group_name: str
    permission: str


class ListSharesResponse(CamelSchema):
    users: list[UserShareOut]
    groups: list[GroupShareOut]


class UpsertUserShareRequest(CamelSchema):
    user_id: str
    permission: Literal["viewer", "editor"]


class DeleteUserShareRequest(CamelSchema):
    user_id: str


class UpsertGroupShareRequest(CamelSchema):
    group_id: str
    permission: Literal["viewer", "editor"]


class DeleteGroupShareRequest(CamelSchema):
    group_id: str

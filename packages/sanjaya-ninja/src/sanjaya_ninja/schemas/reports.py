"""Schemas for saved-report CRUD, lifecycle, and sharing endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from ninja import Schema


# ---------------------------------------------------------------------------
# User reference (thin — host project owns the real model)
# ---------------------------------------------------------------------------


class UserReferenceOut(Schema):
    id: str
    name: str
    email: str | None = None


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


class DynamicReportOut(Schema):
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


class DynamicReportSummaryOut(Schema):
    id: int
    title: str
    status: str
    created_by: UserReferenceOut
    updated_at: datetime | None = None
    version: int
    available_actions: list[str]
    metadata: dict | None = None


class ListDynamicReportsResponse(Schema):
    reports: list[DynamicReportSummaryOut]
    total: int
    limit: int
    offset: int


class CreateDynamicReportRequest(Schema):
    title: str
    description: str = ""
    tags: list[str] = []
    metadata: dict | None = None


class UpdateDynamicReportRequest(Schema):
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    metadata: dict | None = None


class PerformActionRequest(Schema):
    action: str
    reason: str | None = None
    target_user_id: str | None = None


class ActionResponse(Schema):
    report: DynamicReportOut | None = None
    message: str


class DynamicReportStatsOut(Schema):
    total: int
    drafts: int
    published: int
    archived: int
    by_type: dict[str, int]


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------


class UserShareOut(Schema):
    user: UserReferenceOut
    permission: str


class GroupShareOut(Schema):
    group_id: str
    group_name: str
    permission: str


class ListSharesResponse(Schema):
    users: list[UserShareOut]
    groups: list[GroupShareOut]


class UpsertUserShareRequest(Schema):
    user_id: str
    permission: Literal["viewer", "editor"]


class DeleteUserShareRequest(Schema):
    user_id: str


class UpsertGroupShareRequest(Schema):
    group_id: str
    permission: Literal["viewer", "editor"]


class DeleteGroupShareRequest(Schema):
    group_id: str

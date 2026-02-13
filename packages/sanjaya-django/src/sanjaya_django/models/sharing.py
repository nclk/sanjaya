"""Django ORM models for report sharing."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models

from sanjaya_django.models.report import DynamicReport


class Permission(models.TextChoices):
    VIEWER = "viewer", "Viewer"
    EDITOR = "editor", "Editor"
    OWNER = "owner", "Owner"  # implicit — resolved from created_by, never stored in shares


# Only viewer/editor may be assigned via a share row.
# Ownership is determined solely by DynamicReport.created_by.
SHARE_CHOICES = [
    (Permission.VIEWER, "Viewer"),
    (Permission.EDITOR, "Editor"),
]


class DynamicReportUserShare(models.Model):
    """Per-user share on a report."""

    report = models.ForeignKey(
        DynamicReport,
        on_delete=models.CASCADE,
        related_name="user_shares",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sanjaya_shared_reports",
    )
    permission = models.CharField(
        max_length=10,
        choices=SHARE_CHOICES,
        default=Permission.VIEWER,
    )

    class Meta:
        default_permissions = ()
        unique_together = [("report", "user")]

    def __str__(self) -> str:
        return f"{self.user} → {self.report} ({self.permission})"


class DynamicReportGroupShare(models.Model):
    """Per-group share on a report."""

    report = models.ForeignKey(
        DynamicReport,
        on_delete=models.CASCADE,
        related_name="group_shares",
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="sanjaya_shared_reports",
    )
    permission = models.CharField(
        max_length=10,
        choices=SHARE_CHOICES,
        default=Permission.VIEWER,
    )

    class Meta:
        default_permissions = ()
        unique_together = [("report", "group")]

    def __str__(self) -> str:
        return f"{self.group} → {self.report} ({self.permission})"

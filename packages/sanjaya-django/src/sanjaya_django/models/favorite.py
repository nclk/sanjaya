"""Django ORM model for report favorites (per-user toggle)."""

from __future__ import annotations

from django.conf import settings
from django.db import models

from sanjaya_django.models.report import DynamicReport


class DynamicReportFavorite(models.Model):
    """Per-user favorite flag on a report."""

    report = models.ForeignKey(
        DynamicReport,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sanjaya_favorites",
    )

    class Meta:
        default_permissions = ()
        unique_together = [("report", "user")]

    def __str__(self) -> str:
        return f"{self.user} ★ {self.report}"

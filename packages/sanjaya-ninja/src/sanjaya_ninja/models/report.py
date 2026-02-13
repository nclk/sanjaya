"""Django ORM model for a saved dynamic report."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class DynamicReport(models.Model):
    """A saved dynamic report definition with lifecycle management."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sanjaya_reports_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sanjaya_reports_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)

    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sanjaya_reports_published",
    )

    archived_at = models.DateTimeField(null=True, blank=True)

    version = models.PositiveIntegerField(default=1)
    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        default_permissions = ()
        permissions = [
            ("can_view_any", "Can view any report"),
            ("can_edit_any", "Can edit any report"),
            ("can_publish_any", "Can publish any report"),
            ("can_destroy_any", "Can destroy any report"),
            ("can_manage_shares_any", "Can manage shares on any report"),
            ("can_transfer_ownership_any", "Can transfer ownership of any report"),
        ]

    def __str__(self) -> str:
        return self.title

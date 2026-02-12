"""Tests for saved-report CRUD, lifecycle, and sharing endpoints."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from sanjaya.models import DynamicReport

User = get_user_model()


@pytest.fixture()
def other_user(db):
    return User.objects.create_user(
        username="other", password="pass", email="other@example.com"
    )


@pytest.fixture()
def report(db, user):
    return DynamicReport.objects.create(
        title="My Report",
        description="A test report",
        created_by=user,
        tags=["test"],
        metadata={"datasetKey": "test_trades"},
    )


@pytest.mark.django_db
class TestReportsCRUD:
    def test_create_report(self, client, user):
        resp = client.post(
            "/reports/",
            json={"title": "New Report", "tags": ["alpha"]},
            user=user,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Report"
        assert data["status"] == "draft"
        assert data["created_by"]["id"] == str(user.pk)

    def test_get_report(self, client, user, report):
        resp = client.get(f"/reports/{report.pk}", user=user)
        assert resp.status_code == 200
        assert resp.json()["title"] == "My Report"

    def test_get_report_not_found(self, client, user):
        resp = client.get("/reports/99999", user=user)
        assert resp.status_code == 404

    def test_get_report_forbidden(self, client, other_user, report):
        resp = client.get(f"/reports/{report.pk}", user=other_user)
        assert resp.status_code == 403

    def test_update_report(self, client, user, report):
        resp = client.patch(
            f"/reports/{report.pk}",
            json={"title": "Updated Title"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"
        assert resp.json()["version"] == 2

    def test_list_reports(self, client, user, report):
        resp = client.get("/reports/", user=user)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1


@pytest.mark.django_db
class TestReportsLifecycle:
    def test_publish_and_unpublish(self, client, user, report):
        # Publish
        resp = client.post(
            f"/reports/{report.pk}/actions",
            json={"action": "publish"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"]["status"] == "published"

        # Unpublish
        resp = client.post(
            f"/reports/{report.pk}/actions",
            json={"action": "unpublish"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"]["status"] == "draft"

    def test_archive_and_restore(self, client, user, report):
        # Must publish first
        client.post(
            f"/reports/{report.pk}/actions",
            json={"action": "publish"},
            user=user,
        )
        # Archive
        resp = client.post(
            f"/reports/{report.pk}/actions",
            json={"action": "archive"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"]["status"] == "archived"

        # Restore
        resp = client.post(
            f"/reports/{report.pk}/actions",
            json={"action": "restore"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"]["status"] == "draft"

    def test_delete_report(self, client, user, report):
        resp = client.post(
            f"/reports/{report.pk}/actions",
            json={"action": "delete"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"] is None
        assert not DynamicReport.objects.filter(pk=report.pk).exists()

    def test_forbidden_action(self, client, other_user, report):
        resp = client.post(
            f"/reports/{report.pk}/actions",
            json={"action": "publish"},
            user=other_user,
        )
        assert resp.status_code == 403

    def test_list_actions(self, client, user, report):
        resp = client.get(f"/reports/{report.pk}/actions", user=user)
        assert resp.status_code == 200
        actions = resp.json()["actions"]
        assert "publish" in actions
        assert "edit" in actions

    def test_stats(self, client, user, report):
        resp = client.get("/reports/stats", user=user)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert data["drafts"] >= 1


@pytest.mark.django_db
class TestReportsSharing:
    def test_upsert_and_list_user_share(self, client, user, other_user, report):
        resp = client.post(
            f"/reports/{report.pk}/shares/users",
            json={"user_id": str(other_user.pk), "permission": "viewer"},
            user=user,
        )
        assert resp.status_code == 200
        shares = resp.json()
        assert len(shares["users"]) == 1
        assert shares["users"][0]["permission"] == "viewer"

    def test_delete_user_share(self, client, user, other_user, report):
        # Create share first
        client.post(
            f"/reports/{report.pk}/shares/users",
            json={"user_id": str(other_user.pk), "permission": "viewer"},
            user=user,
        )
        # Delete
        resp = client.delete(
            f"/reports/{report.pk}/shares/users",
            json={"user_id": str(other_user.pk)},
            user=user,
        )
        assert resp.status_code == 200
        assert len(resp.json()["users"]) == 0

    def test_non_owner_cannot_manage_shares(self, client, other_user, report):
        resp = client.get(f"/reports/{report.pk}/shares", user=other_user)
        assert resp.status_code == 403

    def test_shared_report_visible(self, client, user, other_user, report):
        """After sharing, the other user should be able to view the report."""
        from sanjaya.models import DynamicReportUserShare

        DynamicReportUserShare.objects.create(
            report=report, user=other_user, permission="viewer"
        )
        resp = client.get(f"/reports/{report.pk}", user=other_user)
        assert resp.status_code == 200

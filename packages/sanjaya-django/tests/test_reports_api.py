"""Tests for saved-report CRUD, lifecycle, and sharing endpoints."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from sanjaya_django.models import DynamicReport, DynamicReportFavorite

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
        assert data["createdBy"]["id"] == str(user.pk)

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
            f"/reports/{report.pk}/actions/",
            json={"action": "publish"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"]["status"] == "published"

        # Unpublish
        resp = client.post(
            f"/reports/{report.pk}/actions/",
            json={"action": "unpublish"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"]["status"] == "draft"

    def test_archive_and_restore(self, client, user, report):
        # Must publish first
        client.post(
            f"/reports/{report.pk}/actions/",
            json={"action": "publish"},
            user=user,
        )
        # Archive
        resp = client.post(
            f"/reports/{report.pk}/actions/",
            json={"action": "archive"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"]["status"] == "archived"

        # Restore
        resp = client.post(
            f"/reports/{report.pk}/actions/",
            json={"action": "restore"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"]["status"] == "draft"

    def test_delete_report(self, client, user, report):
        resp = client.post(
            f"/reports/{report.pk}/actions/",
            json={"action": "delete"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["report"] is None
        assert not DynamicReport.objects.filter(pk=report.pk).exists()

    def test_forbidden_action(self, client, other_user, report):
        resp = client.post(
            f"/reports/{report.pk}/actions/",
            json={"action": "publish"},
            user=other_user,
        )
        assert resp.status_code == 403

    def test_list_actions(self, client, user, report):
        resp = client.get(f"/reports/{report.pk}/actions/", user=user)
        assert resp.status_code == 200
        actions = resp.json()["actions"]
        assert "publish" in actions
        assert "edit" in actions

    def test_stats(self, client, user, report):
        resp = client.get("/reports/stats/", user=user)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert data["drafts"] >= 1


@pytest.mark.django_db
class TestReportsSharing:
    def test_upsert_and_list_user_share(self, client, user, other_user, report):
        resp = client.post(
            f"/reports/{report.pk}/shares/users/",
            json={"userId": str(other_user.pk), "permission": "viewer"},
            user=user,
        )
        assert resp.status_code == 200
        shares = resp.json()
        assert len(shares["users"]) == 1
        assert shares["users"][0]["permission"] == "viewer"

    def test_delete_user_share(self, client, user, other_user, report):
        # Create share first
        client.post(
            f"/reports/{report.pk}/shares/users/",
            json={"userId": str(other_user.pk), "permission": "viewer"},
            user=user,
        )
        # Delete
        resp = client.delete(
            f"/reports/{report.pk}/shares/users/",
            json={"userId": str(other_user.pk)},
            user=user,
        )
        assert resp.status_code == 200
        assert len(resp.json()["users"]) == 0

    def test_non_owner_cannot_manage_shares(self, client, other_user, report):
        resp = client.get(f"/reports/{report.pk}/shares/", user=other_user)
        assert resp.status_code == 403

    def test_shared_report_visible(self, client, user, other_user, report):
        """After sharing, the other user should be able to view the report."""
        from sanjaya_django.models import DynamicReportUserShare

        DynamicReportUserShare.objects.create(
            report=report, user=other_user, permission="viewer"
        )
        resp = client.get(f"/reports/{report.pk}", user=other_user)
        assert resp.status_code == 200


@pytest.mark.django_db
class TestPivotDefinitionPersistence:
    """§1 — pivot config round-trips through save/load."""

    def test_save_and_load_pivot_config(self, client, user):
        """Create a report with full pivot definition, reload, verify intact."""
        definition = {
            "datasetKey": "test_trades",
            "selectedColumns": ["year", "region", "amount"],
            "filter": {"combinator": "and", "conditions": []},
            "rowGroupCols": [
                {"id": "region", "displayName": "Region", "field": "region"},
            ],
            "pivotCols": [
                {"id": "year", "displayName": "Year", "field": "year"},
            ],
            "valueCols": [
                {
                    "id": "amount",
                    "displayName": "Amount",
                    "field": "amount",
                    "aggFunc": "sum",
                },
            ],
            "sortModel": [{"colId": "region", "sort": "asc"}],
        }
        metadata = {"datasetKey": "test_trades", "definition": definition}

        # Create
        resp = client.post(
            "/reports/",
            json={"title": "Pivot Report", "metadata": metadata},
            user=user,
        )
        assert resp.status_code == 201
        report_id = resp.json()["id"]

        # Reload
        resp = client.get(f"/reports/{report_id}", user=user)
        assert resp.status_code == 200
        data = resp.json()
        loaded_def = data["metadata"]["definition"]

        assert loaded_def["datasetKey"] == "test_trades"
        assert loaded_def["rowGroupCols"] == definition["rowGroupCols"]
        assert loaded_def["pivotCols"] == definition["pivotCols"]
        assert loaded_def["valueCols"] == definition["valueCols"]
        assert loaded_def["sortModel"] == definition["sortModel"]

    def test_flat_report_still_works(self, client, user):
        """A report with no pivot fields should still round-trip fine."""
        definition = {
            "datasetKey": "test_trades",
            "selectedColumns": ["year", "region"],
            "filter": {"combinator": "and", "conditions": []},
        }
        metadata = {"datasetKey": "test_trades", "definition": definition}

        resp = client.post(
            "/reports/",
            json={"title": "Flat Report", "metadata": metadata},
            user=user,
        )
        assert resp.status_code == 201
        report_id = resp.json()["id"]

        resp = client.get(f"/reports/{report_id}", user=user)
        assert resp.status_code == 200
        loaded_def = resp.json()["metadata"]["definition"]
        assert loaded_def["datasetKey"] == "test_trades"
        assert "rowGroupCols" not in loaded_def
        assert "pivotCols" not in loaded_def


@pytest.mark.django_db
class TestFavoriteAction:
    """§2 — favorite toggle, response field, and list filtering."""

    def test_favorite_toggle(self, client, user, report):
        """Favoriting then re-favoriting should toggle."""
        # Favorite
        resp = client.post(
            f"/reports/{report.pk}/actions/",
            json={"action": "favorite"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Report favorited."
        assert resp.json()["report"]["isFavorited"] is True

        # Unfavorite (toggle)
        resp = client.post(
            f"/reports/{report.pk}/actions/",
            json={"action": "favorite"},
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Report unfavorited."
        assert resp.json()["report"]["isFavorited"] is False

    def test_favorite_in_available_actions(self, client, user, report):
        """favorite should always appear in availableActions for a viewer+."""
        resp = client.get(f"/reports/{report.pk}/actions/", user=user)
        assert resp.status_code == 200
        assert "favorite" in resp.json()["actions"]

    def test_is_favorited_field_on_get(self, client, user, report):
        """isFavorited should reflect the current state."""
        resp = client.get(f"/reports/{report.pk}", user=user)
        assert resp.json()["isFavorited"] is False

        # Favorite it
        DynamicReportFavorite.objects.create(report=report, user=user)

        resp = client.get(f"/reports/{report.pk}", user=user)
        assert resp.json()["isFavorited"] is True

    def test_list_favorited_filter(self, client, user):
        """?favorited=true should return only favorited reports."""
        r1 = DynamicReport.objects.create(title="Fav1", created_by=user)
        r2 = DynamicReport.objects.create(title="Fav2", created_by=user)
        DynamicReport.objects.create(title="NotFav", created_by=user)

        DynamicReportFavorite.objects.create(report=r1, user=user)
        DynamicReportFavorite.objects.create(report=r2, user=user)

        resp = client.get("/reports/?favorited=true", user=user)
        assert resp.status_code == 200
        titles = {r["title"] for r in resp.json()["reports"]}
        assert titles == {"Fav1", "Fav2"}

    def test_favorite_per_user_isolation(self, client, user, other_user, report):
        """One user's favorite should not affect another user's view."""
        from sanjaya_django.models import DynamicReportUserShare

        # Give other_user access
        DynamicReportUserShare.objects.create(
            report=report, user=other_user, permission="viewer"
        )

        # user favorites; other_user does not
        DynamicReportFavorite.objects.create(report=report, user=user)

        resp = client.get(f"/reports/{report.pk}", user=user)
        assert resp.json()["isFavorited"] is True

        resp = client.get(f"/reports/{report.pk}", user=other_user)
        assert resp.json()["isFavorited"] is False

"""Tests for dataset / columns / preview API endpoints."""

from __future__ import annotations

import pytest


@pytest.mark.django_db
class TestDatasetsAPI:
    def test_list_datasets(self, client, user, mock_provider):
        resp = client.get("/datasets/", user=user)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["datasets"]) == 1
        ds = data["datasets"][0]
        assert ds["key"] == "test_trades"
        assert ds["capabilities"]["pivot"] is True

    def test_list_datasets_unauthenticated(self, client, mock_provider):
        resp = client.get("/datasets/")
        assert resp.status_code == 401

    def test_get_columns(self, client, user, mock_provider):
        resp = client.get("/datasets/test_trades/columns", user=user)
        assert resp.status_code == 200
        columns = resp.json()["columns"]
        assert len(columns) == 4
        names = {c["name"] for c in columns}
        assert names == {"year", "region", "product", "amount"}

    def test_get_columns_not_found(self, client, user):
        resp = client.get("/datasets/nonexistent/columns", user=user)
        assert resp.status_code == 404

    def test_preview(self, client, user, mock_provider):
        resp = client.post(
            "/datasets/test_trades/preview",
            json={
                "selectedColumns": ["year", "region", "amount"],
                "limit": 3,
                "offset": 0,
            },
            user=user,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["columns"] == ["year", "region", "amount"]
        assert len(data["rows"]) == 3
        assert data["total"] == 5

    def test_preview_empty_selected_columns_rejected(self, client, user, mock_provider):
        resp = client.post(
            "/datasets/test_trades/preview",
            json={"selectedColumns": [], "limit": 10, "offset": 0},
            user=user,
        )
        assert resp.status_code == 422

    def test_preview_with_filter(self, client, user, mock_provider):
        resp = client.post(
            "/datasets/test_trades/preview",
            json={
                "selectedColumns": ["year", "amount"],
                "filter": {
                    "combinator": "and",
                    "conditions": [
                        {"column": "region", "operator": "eq", "value": "North"}
                    ],
                },
            },
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 3

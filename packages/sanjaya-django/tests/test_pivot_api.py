"""Tests for the AG Grid SSRM pivot endpoint."""

from __future__ import annotations

import pytest


@pytest.mark.django_db
class TestPivotAPI:
    def test_pivot_mode(self, client, user, mock_provider):
        """Pivot product over region, sum amount."""
        resp = client.post(
            "/datasets/test_trades/pivot",
            json={
                "startRow": 0,
                "endRow": 100,
                "rowGroupCols": [
                    {"id": "region", "displayName": "Region", "field": "region"}
                ],
                "groupKeys": [],
                "valueCols": [
                    {
                        "id": "amount",
                        "displayName": "Amount",
                        "field": "amount",
                        "aggFunc": "sum",
                    }
                ],
                "pivotCols": [
                    {"id": "product", "displayName": "Product", "field": "product"}
                ],
                "pivotMode": True,
            },
            user=user,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["pivotResultFields"] is not None
        assert len(data["pivotResultFields"]) > 0
        assert data["rowCount"] == 2

    def test_pivot_rejects_missing_pivot_cols(self, client, user, mock_provider):
        """400 when pivotMode is True but pivotCols is empty."""
        resp = client.post(
            "/datasets/test_trades/pivot",
            json={
                "startRow": 0,
                "endRow": 100,
                "rowGroupCols": [
                    {"id": "region", "displayName": "Region", "field": "region"}
                ],
                "groupKeys": [],
                "valueCols": [
                    {
                        "id": "amount",
                        "displayName": "Amount",
                        "field": "amount",
                        "aggFunc": "sum",
                    }
                ],
                "pivotCols": [],
                "pivotMode": True,
            },
            user=user,
        )
        assert resp.status_code == 400
        data = resp.json()
        assert data["details"][0]["error_type"] == "validation"
        assert "/table" in data["details"][0]["message"]

    def test_pivot_rejects_pivot_mode_false(self, client, user, mock_provider):
        """400 when pivotMode is False."""
        resp = client.post(
            "/datasets/test_trades/pivot",
            json={
                "startRow": 0,
                "endRow": 100,
                "rowGroupCols": [
                    {"id": "region", "displayName": "Region", "field": "region"}
                ],
                "groupKeys": [],
                "valueCols": [],
                "pivotCols": [
                    {"id": "product", "displayName": "Product", "field": "product"}
                ],
                "pivotMode": False,
            },
            user=user,
        )
        assert resp.status_code == 400

    def test_pivot_not_supported(self, client, user):
        """Dataset without pivot capability should return 501."""
        from sanjaya_core.mock import MockDataProvider
        from sanjaya_core.types import DatasetCapabilities
        from sanjaya_django.registry import registry

        registry.add(
            MockDataProvider(
                key="no_pivot",
                label="No Pivot",
                columns=[],
                data=[],
                capabilities=DatasetCapabilities(pivot=False),
            )
        )

        resp = client.post(
            "/datasets/no_pivot/pivot",
            json={
                "startRow": 0,
                "endRow": 10,
                "rowGroupCols": [],
                "groupKeys": [],
                "valueCols": [],
                "pivotCols": [{"id": "x", "displayName": "X"}],
                "pivotMode": True,
            },
            user=user,
        )
        assert resp.status_code == 501

    def test_dataset_not_found(self, client, user):
        resp = client.post(
            "/datasets/nope/pivot",
            json={
                "startRow": 0,
                "endRow": 10,
                "rowGroupCols": [],
                "groupKeys": [],
                "valueCols": [],
                "pivotCols": [{"id": "x", "displayName": "X"}],
                "pivotMode": True,
            },
            user=user,
        )
        assert resp.status_code == 404

    def test_auth_required(self, client, mock_provider):
        resp = client.post(
            "/datasets/test_trades/pivot",
            json={
                "startRow": 0,
                "endRow": 10,
                "rowGroupCols": [],
                "groupKeys": [],
                "valueCols": [],
                "pivotCols": [{"id": "x", "displayName": "X"}],
                "pivotMode": True,
            },
        )
        assert resp.status_code == 401

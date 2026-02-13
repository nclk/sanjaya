"""Tests for the AG Grid SSRM pivot endpoint."""

from __future__ import annotations

import pytest


@pytest.mark.django_db
class TestPivotAPI:
    def test_simple_group_by(self, client, user, mock_provider):
        """Group by region, sum amount — no pivot."""
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
                "pivotMode": False,
                "sortModel": [],
                "filterModel": {},
            },
            user=user,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rowCount"] == 2
        by_region = {r["region"]: r for r in data["rowData"]}
        # North: 100 + 200 + 120 = 420
        assert by_region["North"]["sum_amount"] == 420

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

    def test_drill_down_with_group_keys(self, client, user, mock_provider):
        """Drill into region=North — should return the next group level."""
        resp = client.post(
            "/datasets/test_trades/pivot",
            json={
                "startRow": 0,
                "endRow": 100,
                "rowGroupCols": [
                    {"id": "region", "displayName": "Region", "field": "region"},
                    {"id": "product", "displayName": "Product", "field": "product"},
                ],
                "groupKeys": ["North"],
                "valueCols": [
                    {
                        "id": "amount",
                        "displayName": "Amount",
                        "field": "amount",
                        "aggFunc": "sum",
                    }
                ],
                "pivotCols": [],
                "pivotMode": False,
            },
            user=user,
        )
        assert resp.status_code == 200
        data = resp.json()
        # North has Widget and Gadget
        assert data["rowCount"] == 2
        products = {r["product"] for r in data["rowData"]}
        assert products == {"Widget", "Gadget"}

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
                "pivotCols": [],
                "pivotMode": False,
            },
            user=user,
        )
        assert resp.status_code == 404

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
                "start_row": 0,
                "end_row": 100,
                "row_group_cols": [
                    {"id": "region", "display_name": "Region", "field": "region"}
                ],
                "group_keys": [],
                "value_cols": [
                    {
                        "id": "amount",
                        "display_name": "Amount",
                        "field": "amount",
                        "agg_func": "sum",
                    }
                ],
                "pivot_cols": [],
                "pivot_mode": False,
                "sort_model": [],
                "filter_model": {},
            },
            user=user,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["row_count"] == 2
        by_region = {r["region"]: r for r in data["row_data"]}
        # North: 100 + 200 + 120 = 420
        assert by_region["North"]["sum_amount"] == 420

    def test_pivot_mode(self, client, user, mock_provider):
        """Pivot product over region, sum amount."""
        resp = client.post(
            "/datasets/test_trades/pivot",
            json={
                "start_row": 0,
                "end_row": 100,
                "row_group_cols": [
                    {"id": "region", "display_name": "Region", "field": "region"}
                ],
                "group_keys": [],
                "value_cols": [
                    {
                        "id": "amount",
                        "display_name": "Amount",
                        "field": "amount",
                        "agg_func": "sum",
                    }
                ],
                "pivot_cols": [
                    {"id": "product", "display_name": "Product", "field": "product"}
                ],
                "pivot_mode": True,
            },
            user=user,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["pivot_result_fields"] is not None
        assert len(data["pivot_result_fields"]) > 0
        assert data["row_count"] == 2

    def test_drill_down_with_group_keys(self, client, user, mock_provider):
        """Drill into region=North — should return the next group level."""
        resp = client.post(
            "/datasets/test_trades/pivot",
            json={
                "start_row": 0,
                "end_row": 100,
                "row_group_cols": [
                    {"id": "region", "display_name": "Region", "field": "region"},
                    {"id": "product", "display_name": "Product", "field": "product"},
                ],
                "group_keys": ["North"],
                "value_cols": [
                    {
                        "id": "amount",
                        "display_name": "Amount",
                        "field": "amount",
                        "agg_func": "sum",
                    }
                ],
                "pivot_cols": [],
                "pivot_mode": False,
            },
            user=user,
        )
        assert resp.status_code == 200
        data = resp.json()
        # North has Widget and Gadget
        assert data["row_count"] == 2
        products = {r["product"] for r in data["row_data"]}
        assert products == {"Widget", "Gadget"}

    def test_pivot_not_supported(self, client, user):
        """Dataset without pivot capability should return 501."""
        from sanjaya_core.mock import MockDataProvider
        from sanjaya_core.types import DatasetCapabilities
        from sanjaya.registry import registry

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
                "start_row": 0,
                "end_row": 10,
                "row_group_cols": [],
                "group_keys": [],
                "value_cols": [],
                "pivot_cols": [{"id": "x", "display_name": "X"}],
                "pivot_mode": True,
            },
            user=user,
        )
        assert resp.status_code == 501

    def test_dataset_not_found(self, client, user):
        resp = client.post(
            "/datasets/nope/pivot",
            json={
                "start_row": 0,
                "end_row": 10,
                "row_group_cols": [],
                "group_keys": [],
                "value_cols": [],
                "pivot_cols": [],
                "pivot_mode": False,
            },
            user=user,
        )
        assert resp.status_code == 404

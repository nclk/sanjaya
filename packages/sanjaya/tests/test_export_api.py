"""Tests for the export endpoint."""

from __future__ import annotations

import csv
import io

import pytest


@pytest.mark.django_db
class TestExportAPI:
    def test_flat_csv_export(self, client, user, mock_provider):
        resp = client.post(
            "/datasets/test_trades/export",
            json={
                "flat": {
                    "selected_columns": ["year", "region", "amount"],
                    "format": "csv",
                }
            },
            user=user,
        )
        assert resp.status_code == 200
        assert "text/csv" in resp["Content-Type"]

        content = resp.content.decode()
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        assert len(rows) == 5
        assert reader.fieldnames is not None
        assert set(reader.fieldnames) == {"year", "region", "amount"}

    def test_flat_xlsx_export(self, client, user, mock_provider):
        resp = client.post(
            "/datasets/test_trades/export",
            json={
                "flat": {
                    "selected_columns": ["year", "amount"],
                    "format": "xlsx",
                }
            },
            user=user,
        )
        assert resp.status_code == 200
        assert "spreadsheetml" in resp["Content-Type"]

    def test_pivot_csv_export(self, client, user, mock_provider):
        resp = client.post(
            "/datasets/test_trades/export",
            json={
                "pivot": {
                    "row_group_cols": [
                        {"id": "region", "display_name": "Region", "field": "region"}
                    ],
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
                    "format": "csv",
                }
            },
            user=user,
        )
        assert resp.status_code == 200
        content = resp.content.decode()
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        assert len(rows) == 2  # North, South

    def test_empty_request_returns_400(self, client, user, mock_provider):
        resp = client.post(
            "/datasets/test_trades/export",
            json={},
            user=user,
        )
        assert resp.status_code == 400

    def test_dataset_not_found(self, client, user):
        resp = client.post(
            "/datasets/nope/export",
            json={"flat": {"selected_columns": ["x"], "format": "csv"}},
            user=user,
        )
        assert resp.status_code == 404

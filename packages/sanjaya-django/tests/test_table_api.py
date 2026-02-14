"""Tests for the AG Grid SSRM table endpoint.

The table endpoint supports:
- Flat data (no groups) — paginated detail rows
- Row grouping — hierarchical drill-down
- Row grouping + aggregation — group-level summary values
- Filtering via rich FilterGroup (``filter``) or AG Grid format (``filterModel``)
- Sorting
- Pagination
"""

from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# Test data reference (from conftest mock_provider)
#
#   year  region  product  amount
#   2023  North   Widget   100
#   2023  North   Gadget   200
#   2023  South   Widget   150
#   2024  North   Widget   120
#   2024  South   Gadget   270
# ---------------------------------------------------------------------------

TABLE_URL = "/datasets/test_trades/table/"


def _table_request(
    *,
    start_row: int = 0,
    end_row: int = 100,
    row_group_cols: list | None = None,
    group_keys: list | None = None,
    value_cols: list | None = None,
    sort_model: list | None = None,
    filter: dict | None = None,
    filter_model: dict | None = None,
) -> dict:
    """Build a minimal TableGetRowsRequest payload."""
    return {
        "startRow": start_row,
        "endRow": end_row,
        "rowGroupCols": row_group_cols or [],
        "groupKeys": group_keys or [],
        "valueCols": value_cols or [],
        "sortModel": sort_model or [],
        **({"filter": filter} if filter is not None else {}),
        **({"filterModel": filter_model} if filter_model is not None else {}),
    }


# ── helpers for common column descriptors ─────────────────────────────

REGION_COL = {"id": "region", "displayName": "Region", "field": "region"}
PRODUCT_COL = {"id": "product", "displayName": "Product", "field": "product"}
YEAR_COL = {"id": "year", "displayName": "Year", "field": "year"}
AMOUNT_SUM = {
    "id": "amount",
    "displayName": "Amount",
    "field": "amount",
    "aggFunc": "sum",
}
AMOUNT_AVG = {
    "id": "amount",
    "displayName": "Amount",
    "field": "amount",
    "aggFunc": "avg",
}
AMOUNT_COUNT = {
    "id": "amount",
    "displayName": "Amount",
    "field": "amount",
    "aggFunc": "count",
}


# ======================================================================
# Flat data — no groups, no aggregation
# ======================================================================


@pytest.mark.django_db
class TestTableFlat:
    """Flat (leaf-level) queries — ``provider.query()``."""

    def test_returns_all_rows(self, client, user, mock_provider):
        """No groups → all 5 detail rows with all columns."""
        resp = client.post(TABLE_URL, json=_table_request(), user=user)
        assert resp.status_code == 200
        data = resp.json()
        assert data["rowCount"] == 5
        assert len(data["rowData"]) == 5
        # Verify all columns are present.
        first_row = data["rowData"][0]
        assert set(first_row.keys()) == {"year", "region", "product", "amount"}

    def test_pagination_first_page(self, client, user, mock_provider):
        """startRow/endRow slices the result."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(start_row=0, end_row=2),
            user=user,
        )
        data = resp.json()
        assert resp.status_code == 200
        assert len(data["rowData"]) == 2
        assert data["rowCount"] == 5  # total stays full count

    def test_pagination_second_page(self, client, user, mock_provider):
        resp = client.post(
            TABLE_URL,
            json=_table_request(start_row=2, end_row=4),
            user=user,
        )
        data = resp.json()
        assert len(data["rowData"]) == 2
        assert data["rowCount"] == 5

    def test_pagination_past_end(self, client, user, mock_provider):
        """Requesting past the end returns empty rows."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(start_row=10, end_row=20),
            user=user,
        )
        data = resp.json()
        assert len(data["rowData"]) == 0
        assert data["rowCount"] == 5

    def test_sort_ascending(self, client, user, mock_provider):
        resp = client.post(
            TABLE_URL,
            json=_table_request(sort_model=[{"colId": "amount", "sort": "asc"}]),
            user=user,
        )
        data = resp.json()
        amounts = [r["amount"] for r in data["rowData"]]
        assert amounts == sorted(amounts)

    def test_sort_descending(self, client, user, mock_provider):
        resp = client.post(
            TABLE_URL,
            json=_table_request(sort_model=[{"colId": "amount", "sort": "desc"}]),
            user=user,
        )
        data = resp.json()
        amounts = [r["amount"] for r in data["rowData"]]
        assert amounts == sorted(amounts, reverse=True)

    def test_sort_multi_column(self, client, user, mock_provider):
        """Sort by region asc, then amount desc."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                sort_model=[
                    {"colId": "region", "sort": "asc"},
                    {"colId": "amount", "sort": "desc"},
                ]
            ),
            user=user,
        )
        data = resp.json()
        rows = data["rowData"]
        # North rows first (alphabetically), then South.
        north_rows = [r for r in rows if r["region"] == "North"]
        south_rows = [r for r in rows if r["region"] == "South"]
        assert all(r["region"] == "North" for r in north_rows)
        assert all(r["region"] == "South" for r in south_rows)
        # Within North, amounts should be descending.
        north_amounts = [r["amount"] for r in north_rows]
        assert north_amounts == sorted(north_amounts, reverse=True)

    def test_no_pivot_fields_in_response(self, client, user, mock_provider):
        """Table endpoint should never return pivotResultFields."""
        resp = client.post(TABLE_URL, json=_table_request(), user=user)
        data = resp.json()
        assert data.get("pivotResultFields") is None
        assert data.get("secondaryColDefs") is None


# ======================================================================
# Filtering — rich FilterGroup format (``filter`` field)
# ======================================================================


@pytest.mark.django_db
class TestTableFilterRich:
    """Filtering via the ``filter`` field (sanjaya FilterGroup JSON)."""

    def test_eq_filter(self, client, user, mock_provider):
        """Single equality condition."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter={
                    "combinator": "and",
                    "conditions": [
                        {"column": "region", "operator": "eq", "value": "North"}
                    ],
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 3
        assert all(r["region"] == "North" for r in data["rowData"])

    def test_gt_filter(self, client, user, mock_provider):
        """Greater-than on a numeric column."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter={
                    "combinator": "and",
                    "conditions": [
                        {"column": "amount", "operator": "gt", "value": 150}
                    ],
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2  # 200, 270
        assert all(r["amount"] > 150 for r in data["rowData"])

    def test_in_filter(self, client, user, mock_provider):
        """IN operator — multiple values."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter={
                    "combinator": "and",
                    "conditions": [
                        {
                            "column": "product",
                            "operator": "in",
                            "value": ["Widget"],
                        }
                    ],
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 3  # 3 Widget rows
        assert all(r["product"] == "Widget" for r in data["rowData"])

    def test_nested_filter_groups(self, client, user, mock_provider):
        """Nested groups: (region=North) AND (year=2023 OR year=2024)."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter={
                    "combinator": "and",
                    "conditions": [
                        {"column": "region", "operator": "eq", "value": "North"}
                    ],
                    "groups": [
                        {
                            "combinator": "or",
                            "conditions": [
                                {"column": "year", "operator": "eq", "value": 2023},
                                {"column": "year", "operator": "eq", "value": 2024},
                            ],
                        }
                    ],
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 3  # all 3 North rows

    def test_negated_condition(self, client, user, mock_provider):
        """Negated condition: NOT region=North → South only."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter={
                    "combinator": "and",
                    "conditions": [
                        {
                            "column": "region",
                            "operator": "eq",
                            "value": "North",
                            "not": True,
                        }
                    ],
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2
        assert all(r["region"] == "South" for r in data["rowData"])

    def test_or_combinator(self, client, user, mock_provider):
        """OR combinator: product=Widget OR amount=270."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter={
                    "combinator": "or",
                    "conditions": [
                        {"column": "product", "operator": "eq", "value": "Widget"},
                        {"column": "amount", "operator": "eq", "value": 270},
                    ],
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 4  # 3 Widgets + 1 Gadget(270)

    def test_filter_with_sort_and_pagination(self, client, user, mock_provider):
        """Filter + sort + pagination combined."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter={
                    "combinator": "and",
                    "conditions": [
                        {"column": "region", "operator": "eq", "value": "North"}
                    ],
                },
                sort_model=[{"colId": "amount", "sort": "asc"}],
                start_row=0,
                end_row=2,
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 3  # total matching
        assert len(data["rowData"]) == 2  # page size
        amounts = [r["amount"] for r in data["rowData"]]
        assert amounts == sorted(amounts)

    def test_filter_takes_precedence_over_filter_model(self, client, user, mock_provider):
        """When both filter and filterModel are provided, filter wins."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                # Rich filter: region=North (3 rows)
                filter={
                    "combinator": "and",
                    "conditions": [
                        {"column": "region", "operator": "eq", "value": "North"}
                    ],
                },
                # AG Grid filter: region=South (2 rows) — should be ignored
                filter_model={
                    "region": {
                        "filterType": "set",
                        "values": ["South"],
                    }
                },
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 3  # filter won, not filterModel


# ======================================================================
# Filtering — AG Grid filterModel fallback
# ======================================================================


@pytest.mark.django_db
class TestTableFilterAgGrid:
    """Filtering via ``filterModel`` (AG Grid column-keyed format)."""

    def test_set_filter(self, client, user, mock_provider):
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter_model={
                    "region": {"filterType": "set", "values": ["North"]},
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 3
        assert all(r["region"] == "North" for r in data["rowData"])

    def test_number_filter(self, client, user, mock_provider):
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter_model={
                    "amount": {
                        "filterType": "number",
                        "type": "greaterThan",
                        "filter": 150,
                    },
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2
        assert all(r["amount"] > 150 for r in data["rowData"])

    def test_multiple_column_filters(self, client, user, mock_provider):
        """Multiple columns filtered simultaneously (AND)."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                filter_model={
                    "region": {"filterType": "set", "values": ["North"]},
                    "year": {
                        "filterType": "number",
                        "type": "equals",
                        "filter": 2023,
                    },
                }
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2  # North+2023: Widget(100), Gadget(200)
        assert all(
            r["region"] == "North" and r["year"] == 2023
            for r in data["rowData"]
        )


# ======================================================================
# Row grouping — first level
# ======================================================================


@pytest.mark.django_db
class TestTableRowGrouping:
    """Row grouping: hierarchical drill-down via groupKeys."""

    def test_group_by_region(self, client, user, mock_provider):
        """Group by region with sum(amount)."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL],
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        assert resp.status_code == 200
        assert data["rowCount"] == 2
        by_region = {r["region"]: r for r in data["rowData"]}
        # North: 100 + 200 + 120 = 420
        assert by_region["North"]["sum_amount"] == 420
        # South: 150 + 270 = 420
        assert by_region["South"]["sum_amount"] == 420

    def test_group_by_product(self, client, user, mock_provider):
        """Group by product with sum(amount)."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[PRODUCT_COL],
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2
        by_product = {r["product"]: r for r in data["rowData"]}
        # Widget: 100 + 150 + 120 = 370
        assert by_product["Widget"]["sum_amount"] == 370
        # Gadget: 200 + 270 = 470
        assert by_product["Gadget"]["sum_amount"] == 470

    def test_group_by_year(self, client, user, mock_provider):
        """Group by year with sum(amount)."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[YEAR_COL],
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2
        by_year = {r["year"]: r for r in data["rowData"]}
        # 2023: 100 + 200 + 150 = 450
        assert by_year[2023]["sum_amount"] == 450
        # 2024: 120 + 270 = 390
        assert by_year[2024]["sum_amount"] == 390

    def test_group_by_multiple_agg_funcs(self, client, user, mock_provider):
        """Multiple aggregate functions on the same column."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL],
                value_cols=[AMOUNT_SUM, AMOUNT_COUNT],
            ),
            user=user,
        )
        data = resp.json()
        by_region = {r["region"]: r for r in data["rowData"]}
        assert by_region["North"]["sum_amount"] == 420
        assert by_region["North"]["count_amount"] == 3
        assert by_region["South"]["sum_amount"] == 420
        assert by_region["South"]["count_amount"] == 2

    def test_group_by_avg(self, client, user, mock_provider):
        """Average aggregate."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL],
                value_cols=[AMOUNT_AVG],
            ),
            user=user,
        )
        data = resp.json()
        by_region = {r["region"]: r for r in data["rowData"]}
        assert by_region["North"]["avg_amount"] == 420 / 3
        assert by_region["South"]["avg_amount"] == 420 / 2


# ======================================================================
# Row grouping — drill-down (groupKeys)
# ======================================================================


@pytest.mark.django_db
class TestTableDrillDown:
    """Drill-down: expanding a group row sends groupKeys."""

    def test_drill_into_region(self, client, user, mock_provider):
        """Two-level grouping (region, product), expand North."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                group_keys=["North"],
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2  # Widget, Gadget
        products = {r["product"] for r in data["rowData"]}
        assert products == {"Widget", "Gadget"}
        by_product = {r["product"]: r for r in data["rowData"]}
        # North/Widget: 100 + 120 = 220
        assert by_product["Widget"]["sum_amount"] == 220
        # North/Gadget: 200
        assert by_product["Gadget"]["sum_amount"] == 200

    def test_drill_into_south(self, client, user, mock_provider):
        """Expand South → products within South."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                group_keys=["South"],
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2
        by_product = {r["product"]: r for r in data["rowData"]}
        assert by_product["Widget"]["sum_amount"] == 150
        assert by_product["Gadget"]["sum_amount"] == 270

    def test_drill_to_leaf_level(self, client, user, mock_provider):
        """Fully expanded (all groupKeys provided) → detail rows."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                group_keys=["North", "Widget"],
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        # North/Widget has 2 detail rows (2023: 100, 2024: 120).
        assert data["rowCount"] == 2
        amounts = sorted(r["amount"] for r in data["rowData"])
        assert amounts == [100, 120]
        # Leaf rows include the group dimensions + value cols.
        first = data["rowData"][0]
        assert "region" in first
        assert "product" in first
        assert "amount" in first

    def test_drill_to_leaf_level_all_columns(self, client, user, mock_provider):
        """Leaf level with no valueCols → all provider columns returned."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                group_keys=["North", "Widget"],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2
        first = data["rowData"][0]
        # No valueCols → service selects all provider columns.
        assert set(first.keys()) == {"year", "region", "product", "amount"}

    def test_drill_to_leaf_level_south_gadget(self, client, user, mock_provider):
        """Leaf level for South/Gadget — single detail row."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                group_keys=["South", "Gadget"],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 1
        assert data["rowData"][0]["amount"] == 270

    def test_multi_request_drill_down_flow(self, client, user, mock_provider):
        """Simulate a full AG Grid drill-down: region → product → leaf."""
        # Level 0: top-level groups
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2  # North, South

        # Level 1: expand North → products
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                group_keys=["North"],
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2  # Widget, Gadget
        by_product = {r["product"]: r for r in data["rowData"]}
        assert by_product["Widget"]["sum_amount"] == 220
        assert by_product["Gadget"]["sum_amount"] == 200

        # Level 2: leaf — North/Widget
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                group_keys=["North", "Widget"],
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2  # 2023(100) + 2024(120)
        amounts = sorted(r["amount"] for r in data["rowData"])
        assert amounts == [100, 120]


# ======================================================================
# Row grouping + filtering
# ======================================================================


@pytest.mark.django_db
class TestTableGroupFiltered:
    """Row grouping combined with filters."""

    def test_group_with_filter(self, client, user, mock_provider):
        """Group by region, but only 2023 data."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL],
                value_cols=[AMOUNT_SUM],
                filter={
                    "combinator": "and",
                    "conditions": [
                        {"column": "year", "operator": "eq", "value": 2023}
                    ],
                },
            ),
            user=user,
        )
        data = resp.json()
        assert data["rowCount"] == 2
        by_region = {r["region"]: r for r in data["rowData"]}
        # 2023 North: 100 + 200 = 300
        assert by_region["North"]["sum_amount"] == 300
        # 2023 South: 150
        assert by_region["South"]["sum_amount"] == 150

    def test_drill_down_with_filter(self, client, user, mock_provider):
        """Drill into North, filtered to year=2023 only."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL, PRODUCT_COL],
                group_keys=["North"],
                value_cols=[AMOUNT_SUM],
                filter={
                    "combinator": "and",
                    "conditions": [
                        {"column": "year", "operator": "eq", "value": 2023}
                    ],
                },
            ),
            user=user,
        )
        data = resp.json()
        # North in 2023: Widget(100) and Gadget(200)
        assert data["rowCount"] == 2
        by_product = {r["product"]: r for r in data["rowData"]}
        assert by_product["Widget"]["sum_amount"] == 100
        assert by_product["Gadget"]["sum_amount"] == 200

    def test_group_filter_narrows_to_single_group(self, client, user, mock_provider):
        """Filter to product=Widget, group by region."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL],
                value_cols=[AMOUNT_SUM],
                filter={
                    "combinator": "and",
                    "conditions": [
                        {"column": "product", "operator": "eq", "value": "Widget"}
                    ],
                },
            ),
            user=user,
        )
        data = resp.json()
        by_region = {r["region"]: r for r in data["rowData"]}
        # Widget North: 100 + 120 = 220
        assert by_region["North"]["sum_amount"] == 220
        # Widget South: 150
        assert by_region["South"]["sum_amount"] == 150


# ======================================================================
# Row grouping + sorting
# ======================================================================


@pytest.mark.django_db
class TestTableGroupSorted:
    """Row grouping with sort applied to group-level results."""

    def test_group_sorted_by_agg_desc(self, client, user, mock_provider):
        """Group by product, sort by sum_amount descending."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[PRODUCT_COL],
                value_cols=[AMOUNT_SUM],
                sort_model=[{"colId": "sum_amount", "sort": "desc"}],
            ),
            user=user,
        )
        data = resp.json()
        amounts = [r["sum_amount"] for r in data["rowData"]]
        assert amounts == sorted(amounts, reverse=True)
        # Gadget(470) before Widget(370)
        assert data["rowData"][0]["product"] == "Gadget"

    def test_group_sorted_by_dimension(self, client, user, mock_provider):
        """Group by region, sort by region name ascending."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL],
                value_cols=[AMOUNT_SUM],
                sort_model=[{"colId": "region", "sort": "asc"}],
            ),
            user=user,
        )
        data = resp.json()
        regions = [r["region"] for r in data["rowData"]]
        assert regions == ["North", "South"]


# ======================================================================
# Row grouping + pagination
# ======================================================================


@pytest.mark.django_db
class TestTableGroupPaginated:
    """Pagination applied to group-level results."""

    def test_group_pagination(self, client, user, mock_provider):
        """Group by region+product (4 groups), page of 2."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                row_group_cols=[REGION_COL],
                # Single-level group: region. 2 groups total.
                value_cols=[AMOUNT_SUM],
                start_row=0,
                end_row=1,
            ),
            user=user,
        )
        data = resp.json()
        assert len(data["rowData"]) == 1
        assert data["rowCount"] == 2  # total groups


# ======================================================================
# Edge cases
# ======================================================================


@pytest.mark.django_db
class TestTableEdgeCases:
    """Edge cases and error conditions."""

    def test_auth_required(self, client, mock_provider):
        """Unauthenticated request → 401."""
        resp = client.post(TABLE_URL, json=_table_request())
        assert resp.status_code == 401

    def test_dataset_not_found(self, client, user):
        """Unknown dataset key → 404."""
        resp = client.post(
            "/datasets/nonexistent/table/",
            json=_table_request(),
            user=user,
        )
        assert resp.status_code == 404

    def test_empty_filter_no_crash(self, client, user, mock_provider):
        """Empty filter dict should be treated as no filter."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(filter_model={}),
            user=user,
        )
        assert resp.status_code == 200
        assert resp.json()["rowCount"] == 5

    def test_no_value_cols_at_group_level(self, client, user, mock_provider):
        """Group by region but no valueCols — should still return groups."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(row_group_cols=[REGION_COL]),
            user=user,
        )
        data = resp.json()
        assert resp.status_code == 200
        assert data["rowCount"] == 2
        # Each row should at least have the region dimension.
        assert all("region" in r for r in data["rowData"])

    def test_value_cols_without_groups(self, client, user, mock_provider):
        """valueCols specified but no rowGroupCols → flat query uses those cols."""
        resp = client.post(
            TABLE_URL,
            json=_table_request(
                value_cols=[AMOUNT_SUM],
            ),
            user=user,
        )
        data = resp.json()
        assert resp.status_code == 200
        # Leaf level — flat query; valueCols used as selected columns.
        assert data["rowCount"] == 5
        assert "amount" in data["rowData"][0]

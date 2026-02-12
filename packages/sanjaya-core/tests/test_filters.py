"""Tests for FilterCondition and FilterGroup evaluation."""

from sanjaya_core.enums import FilterCombinator, FilterOperator
from sanjaya_core.filters import FilterCondition, FilterGroup


class TestFilterCondition:
    def test_eq(self):
        c = FilterCondition(column="x", operator=FilterOperator.EQ, value=1)
        assert c.evaluate({"x": 1}) is True
        assert c.evaluate({"x": 2}) is False

    def test_neq(self):
        c = FilterCondition(column="x", operator=FilterOperator.NEQ, value=1)
        assert c.evaluate({"x": 2}) is True
        assert c.evaluate({"x": 1}) is False

    def test_gt_lt(self):
        gt = FilterCondition(column="x", operator=FilterOperator.GT, value=5)
        lt = FilterCondition(column="x", operator=FilterOperator.LT, value=5)
        assert gt.evaluate({"x": 10}) is True
        assert gt.evaluate({"x": 3}) is False
        assert lt.evaluate({"x": 3}) is True
        assert lt.evaluate({"x": 10}) is False

    def test_gte_lte(self):
        gte = FilterCondition(column="x", operator=FilterOperator.GTE, value=5)
        lte = FilterCondition(column="x", operator=FilterOperator.LTE, value=5)
        assert gte.evaluate({"x": 5}) is True
        assert gte.evaluate({"x": 4}) is False
        assert lte.evaluate({"x": 5}) is True
        assert lte.evaluate({"x": 6}) is False

    def test_contains(self):
        c = FilterCondition(column="x", operator=FilterOperator.CONTAINS, value="ell")
        assert c.evaluate({"x": "hello"}) is True
        assert c.evaluate({"x": "world"}) is False

    def test_startswith_endswith(self):
        sw = FilterCondition(column="x", operator=FilterOperator.STARTSWITH, value="he")
        ew = FilterCondition(column="x", operator=FilterOperator.ENDSWITH, value="lo")
        assert sw.evaluate({"x": "hello"}) is True
        assert sw.evaluate({"x": "world"}) is False
        assert ew.evaluate({"x": "hello"}) is True
        assert ew.evaluate({"x": "world"}) is False

    def test_is_null_is_not_null(self):
        is_null = FilterCondition(column="x", operator=FilterOperator.IS_NULL)
        is_not_null = FilterCondition(column="x", operator=FilterOperator.IS_NOT_NULL)
        assert is_null.evaluate({"x": None}) is True
        assert is_null.evaluate({"x": 1}) is False
        assert is_not_null.evaluate({"x": 1}) is True
        assert is_not_null.evaluate({"x": None}) is False

    def test_between(self):
        c = FilterCondition(column="x", operator=FilterOperator.BETWEEN, value=[3, 7])
        assert c.evaluate({"x": 5}) is True
        assert c.evaluate({"x": 3}) is True
        assert c.evaluate({"x": 7}) is True
        assert c.evaluate({"x": 2}) is False
        assert c.evaluate({"x": 8}) is False

    def test_in(self):
        c = FilterCondition(column="x", operator=FilterOperator.IN, value=[1, 2, 3])
        assert c.evaluate({"x": 2}) is True
        assert c.evaluate({"x": 5}) is False

    def test_negate(self):
        c = FilterCondition(
            column="x", operator=FilterOperator.EQ, value=1, negate=True
        )
        assert c.evaluate({"x": 1}) is False
        assert c.evaluate({"x": 2}) is True

    def test_missing_column_treated_as_none(self):
        c = FilterCondition(column="missing", operator=FilterOperator.IS_NULL)
        assert c.evaluate({"x": 1}) is True

    def test_null_safe_comparison(self):
        c = FilterCondition(column="x", operator=FilterOperator.GT, value=5)
        assert c.evaluate({"x": None}) is False

    def test_between_with_bad_value(self):
        c = FilterCondition(column="x", operator=FilterOperator.BETWEEN, value="bad")
        assert c.evaluate({"x": 5}) is False

    def test_in_with_bad_value(self):
        c = FilterCondition(column="x", operator=FilterOperator.IN, value="not_a_list")
        assert c.evaluate({"x": "n"}) is False


class TestFilterGroup:
    def test_and_group(self):
        fg = FilterGroup(
            combinator=FilterCombinator.AND,
            conditions=[
                FilterCondition(column="x", operator=FilterOperator.GT, value=0),
                FilterCondition(column="x", operator=FilterOperator.LT, value=10),
            ],
        )
        assert fg.evaluate({"x": 5}) is True
        assert fg.evaluate({"x": 15}) is False

    def test_or_group(self):
        fg = FilterGroup(
            combinator=FilterCombinator.OR,
            conditions=[
                FilterCondition(column="x", operator=FilterOperator.EQ, value=1),
                FilterCondition(column="x", operator=FilterOperator.EQ, value=2),
            ],
        )
        assert fg.evaluate({"x": 1}) is True
        assert fg.evaluate({"x": 2}) is True
        assert fg.evaluate({"x": 3}) is False

    def test_nested_groups(self):
        fg = FilterGroup(
            combinator=FilterCombinator.AND,
            conditions=[
                FilterCondition(column="a", operator=FilterOperator.EQ, value=1),
            ],
            groups=[
                FilterGroup(
                    combinator=FilterCombinator.OR,
                    conditions=[
                        FilterCondition(
                            column="b", operator=FilterOperator.EQ, value=10
                        ),
                        FilterCondition(
                            column="b", operator=FilterOperator.EQ, value=20
                        ),
                    ],
                )
            ],
        )
        assert fg.evaluate({"a": 1, "b": 10}) is True
        assert fg.evaluate({"a": 1, "b": 20}) is True
        assert fg.evaluate({"a": 1, "b": 30}) is False
        assert fg.evaluate({"a": 2, "b": 10}) is False

    def test_negate_group(self):
        fg = FilterGroup(
            combinator=FilterCombinator.AND,
            negate=True,
            conditions=[
                FilterCondition(column="x", operator=FilterOperator.EQ, value=1),
            ],
        )
        assert fg.evaluate({"x": 1}) is False
        assert fg.evaluate({"x": 2}) is True

    def test_empty_group_matches_everything(self):
        fg = FilterGroup(combinator=FilterCombinator.AND)
        assert fg.evaluate({"x": 42}) is True

    def test_serialization_round_trip(self):
        """Verify ``not`` alias works in both directions."""
        fg = FilterGroup.model_validate(
            {
                "combinator": "and",
                "not": True,
                "conditions": [
                    {"column": "x", "operator": "eq", "value": 1, "not": True}
                ],
            }
        )
        assert fg.negate is True
        assert fg.conditions[0].negate is True
        dumped = fg.model_dump(by_alias=True)
        assert dumped["not"] is True
        assert dumped["conditions"][0]["not"] is True

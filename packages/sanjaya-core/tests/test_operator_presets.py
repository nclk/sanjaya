"""Tests for the default operator presets."""

from __future__ import annotations

from sanjaya_core.enums import FilterOperator
from sanjaya_core.types import (
    BOOLEAN_OPERATORS,
    DATE_OPERATORS,
    NUMBER_OPERATORS,
    TEXT_OPERATORS,
    ColumnMeta,
)


class TestOperatorPresets:
    """Verify preset contents, immutability, and usability in ColumnMeta."""

    def test_text_operators_contents(self) -> None:
        assert FilterOperator.EQ in TEXT_OPERATORS
        assert FilterOperator.NEQ in TEXT_OPERATORS
        assert FilterOperator.CONTAINS in TEXT_OPERATORS
        assert FilterOperator.STARTSWITH in TEXT_OPERATORS
        assert FilterOperator.ENDSWITH in TEXT_OPERATORS
        assert FilterOperator.IN in TEXT_OPERATORS
        assert FilterOperator.IS_NULL in TEXT_OPERATORS
        assert FilterOperator.IS_NOT_NULL in TEXT_OPERATORS
        # Numeric comparisons should not be in text operators.
        assert FilterOperator.GT not in TEXT_OPERATORS
        assert FilterOperator.BETWEEN not in TEXT_OPERATORS

    def test_number_operators_contents(self) -> None:
        assert FilterOperator.EQ in NUMBER_OPERATORS
        assert FilterOperator.GT in NUMBER_OPERATORS
        assert FilterOperator.GTE in NUMBER_OPERATORS
        assert FilterOperator.LT in NUMBER_OPERATORS
        assert FilterOperator.LTE in NUMBER_OPERATORS
        assert FilterOperator.BETWEEN in NUMBER_OPERATORS
        assert FilterOperator.IN in NUMBER_OPERATORS
        assert FilterOperator.IS_NULL in NUMBER_OPERATORS
        assert FilterOperator.IS_NOT_NULL in NUMBER_OPERATORS
        # Text-specific operators should not be in number operators.
        assert FilterOperator.CONTAINS not in NUMBER_OPERATORS
        assert FilterOperator.STARTSWITH not in NUMBER_OPERATORS

    def test_date_operators_contents(self) -> None:
        assert FilterOperator.EQ in DATE_OPERATORS
        assert FilterOperator.GT in DATE_OPERATORS
        assert FilterOperator.GTE in DATE_OPERATORS
        assert FilterOperator.LT in DATE_OPERATORS
        assert FilterOperator.LTE in DATE_OPERATORS
        assert FilterOperator.BETWEEN in DATE_OPERATORS
        assert FilterOperator.IS_NULL in DATE_OPERATORS
        assert FilterOperator.IS_NOT_NULL in DATE_OPERATORS
        # IN and text ops are not typical for date columns.
        assert FilterOperator.IN not in DATE_OPERATORS
        assert FilterOperator.CONTAINS not in DATE_OPERATORS

    def test_boolean_operators_contents(self) -> None:
        assert FilterOperator.EQ in BOOLEAN_OPERATORS
        assert FilterOperator.NEQ in BOOLEAN_OPERATORS
        assert FilterOperator.IS_NULL in BOOLEAN_OPERATORS
        assert FilterOperator.IS_NOT_NULL in BOOLEAN_OPERATORS
        assert len(BOOLEAN_OPERATORS) == 4

    def test_all_entries_are_filter_operators(self) -> None:
        for preset in (TEXT_OPERATORS, NUMBER_OPERATORS, DATE_OPERATORS, BOOLEAN_OPERATORS):
            for op in preset:
                assert isinstance(op, FilterOperator)

    def test_presets_have_no_duplicates(self) -> None:
        for preset in (TEXT_OPERATORS, NUMBER_OPERATORS, DATE_OPERATORS, BOOLEAN_OPERATORS):
            assert len(preset) == len(set(preset))

    def test_usable_in_column_meta(self) -> None:
        col = ColumnMeta(name="x", label="X", operators=TEXT_OPERATORS)
        assert col.operators == TEXT_OPERATORS

    def test_spread_into_column_meta(self) -> None:
        """Users should be able to spread and extend a preset."""
        ops = [*NUMBER_OPERATORS, FilterOperator.CONTAINS]
        col = ColumnMeta(name="x", label="X", operators=ops)
        assert FilterOperator.CONTAINS in col.operators
        assert FilterOperator.BETWEEN in col.operators

    def test_importable_from_top_level(self) -> None:
        from sanjaya_core import (
            BOOLEAN_OPERATORS as b,
            DATE_OPERATORS as d,
            NUMBER_OPERATORS as n,
            TEXT_OPERATORS as t,
        )
        assert len(t) > 0
        assert len(n) > 0
        assert len(d) > 0
        assert len(b) > 0

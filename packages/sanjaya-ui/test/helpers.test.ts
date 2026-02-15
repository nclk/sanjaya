// ---------------------------------------------------------------------------
// Tests for filter-builder/helpers.ts — pure functions, no DOM
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { ColumnType } from "../src/types/columns";
import type { ColumnMeta } from "../src/types/columns";
import { FilterOperator, FilterCombinator } from "../src/types/filters";
import type { FilterGroup } from "../src/types/filters";
import {
  emptyBasicRow,
  basicRowsToFilterGroup,
  filterGroupToBasicRows,
  isBasicCompatible,
  inputTypeForColumn,
  OPERATOR_LABELS,
  NULL_OPERATORS,
} from "../src/filter-builder/helpers";
import type { BasicRow } from "../src/filter-builder/helpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COLS: ColumnMeta[] = [
  {
    name: "year",
    label: "Year",
    type: ColumnType.Number,
    operators: [FilterOperator.Eq, FilterOperator.Gt],
    nullable: false,
  },
  {
    name: "region",
    label: "Region",
    type: ColumnType.String,
    operators: [FilterOperator.Eq, FilterOperator.In],
    nullable: false,
  },
];

// ---------------------------------------------------------------------------
// emptyBasicRow
// ---------------------------------------------------------------------------

describe("emptyBasicRow", () => {
  it("returns a row with operator ALL and no value", () => {
    const row = emptyBasicRow("year");
    expect(row).toEqual({
      column: "year",
      operator: "ALL",
      value: undefined,
    });
  });
});

// ---------------------------------------------------------------------------
// basicRowsToFilterGroup
// ---------------------------------------------------------------------------

describe("basicRowsToFilterGroup", () => {
  it("excludes ALL rows", () => {
    const rows: BasicRow[] = [
      emptyBasicRow("year"),
      { column: "region", operator: FilterOperator.Eq, value: "North" },
    ];
    const fg = basicRowsToFilterGroup(rows);
    expect(fg.combinator).toBe(FilterCombinator.And);
    expect(fg.conditions).toHaveLength(1);
    expect(fg.conditions![0].column).toBe("region");
  });

  it("returns empty conditions when all rows are ALL", () => {
    const fg = basicRowsToFilterGroup([emptyBasicRow("year")]);
    expect(fg.conditions).toHaveLength(0);
  });

  it("handles Between operator — produces array value", () => {
    const rows: BasicRow[] = [
      {
        column: "year",
        operator: FilterOperator.Between,
        value: "2020",
        valueTo: "2025",
      },
    ];
    const fg = basicRowsToFilterGroup(rows);
    expect(fg.conditions![0].value).toEqual(["2020", "2025"]);
  });

  it("handles In operator — parses comma-separated string", () => {
    const rows: BasicRow[] = [
      {
        column: "region",
        operator: FilterOperator.In,
        value: "North, South, East",
      },
    ];
    const fg = basicRowsToFilterGroup(rows);
    expect(fg.conditions![0].value).toEqual(["North", "South", "East"]);
  });

  it("handles In operator — passes array through", () => {
    const rows: BasicRow[] = [
      {
        column: "region",
        operator: FilterOperator.In,
        value: ["North", "South"],
      },
    ];
    const fg = basicRowsToFilterGroup(rows);
    expect(fg.conditions![0].value).toEqual(["North", "South"]);
  });

  it("omits value for null operators", () => {
    const rows: BasicRow[] = [
      { column: "year", operator: FilterOperator.IsNull, value: undefined },
    ];
    const fg = basicRowsToFilterGroup(rows);
    expect(fg.conditions![0].value).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// filterGroupToBasicRows
// ---------------------------------------------------------------------------

describe("filterGroupToBasicRows", () => {
  it("maps conditions to rows keyed by column", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [
        { column: "year", operator: FilterOperator.Gt, value: "2020" },
      ],
      groups: [],
    };
    const rows = filterGroupToBasicRows(fg, COLS);
    expect(rows).toHaveLength(2); // one per column
    expect(rows[0].column).toBe("year");
    expect(rows[0].operator).toBe(FilterOperator.Gt);
    expect(rows[0].value).toBe("2020");
    // region has no condition → ALL
    expect(rows[1].operator).toBe("ALL");
  });

  it("handles Between — splits array into value / valueTo", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [
        {
          column: "year",
          operator: FilterOperator.Between,
          value: [2020, 2025],
        },
      ],
      groups: [],
    };
    const rows = filterGroupToBasicRows(fg, COLS);
    expect(rows[0].value).toBe(2020);
    expect(rows[0].valueTo).toBe(2025);
  });

  it("handles In — joins array to comma-separated string", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [
        {
          column: "region",
          operator: FilterOperator.In,
          value: ["North", "South"],
        },
      ],
      groups: [],
    };
    const rows = filterGroupToBasicRows(fg, COLS);
    expect(rows[1].value).toBe("North, South");
  });

  it("returns ALL rows when group has no conditions", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [],
      groups: [],
    };
    const rows = filterGroupToBasicRows(fg, COLS);
    expect(rows.every((r) => r.operator === "ALL")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isBasicCompatible
// ---------------------------------------------------------------------------

describe("isBasicCompatible", () => {
  it("returns true for flat AND group", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [
        { column: "year", operator: FilterOperator.Gt, value: "2020" },
      ],
      groups: [],
    };
    expect(isBasicCompatible(fg)).toBe(true);
  });

  it("returns false for OR combinator", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.Or,
      conditions: [],
      groups: [],
    };
    expect(isBasicCompatible(fg)).toBe(false);
  });

  it("returns false when group-level NOT is set", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      not: true,
      conditions: [],
      groups: [],
    };
    expect(isBasicCompatible(fg)).toBe(false);
  });

  it("returns false when nested groups exist", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [],
      groups: [
        { combinator: FilterCombinator.And, conditions: [], groups: [] },
      ],
    };
    expect(isBasicCompatible(fg)).toBe(false);
  });

  it("returns false when any condition has NOT", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [
        {
          column: "year",
          operator: FilterOperator.Gt,
          value: "2020",
          not: true,
        },
      ],
      groups: [],
    };
    expect(isBasicCompatible(fg)).toBe(false);
  });

  it("returns true for empty AND group", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [],
      groups: [],
    };
    expect(isBasicCompatible(fg)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// inputTypeForColumn
// ---------------------------------------------------------------------------

describe("inputTypeForColumn", () => {
  it("returns 'number' for Number columns", () => {
    expect(inputTypeForColumn(COLS[0])).toBe("number");
  });

  it("returns 'number' for Currency columns", () => {
    const col: ColumnMeta = {
      name: "amt",
      label: "Amount",
      type: ColumnType.Currency,
      operators: [],
      nullable: false,
    };
    expect(inputTypeForColumn(col)).toBe("number");
  });

  it("returns 'number' for Percentage columns", () => {
    const col: ColumnMeta = {
      name: "pct",
      label: "Pct",
      type: ColumnType.Percentage,
      operators: [],
      nullable: false,
    };
    expect(inputTypeForColumn(col)).toBe("number");
  });

  it("returns 'date' for Date columns", () => {
    const col: ColumnMeta = {
      name: "d",
      label: "D",
      type: ColumnType.Date,
      operators: [],
      nullable: false,
    };
    expect(inputTypeForColumn(col)).toBe("date");
  });

  it("returns 'datetime-local' for Datetime columns", () => {
    const col: ColumnMeta = {
      name: "dt",
      label: "DT",
      type: ColumnType.Datetime,
      operators: [],
      nullable: false,
    };
    expect(inputTypeForColumn(col)).toBe("datetime-local");
  });

  it("returns 'text' for String columns", () => {
    expect(inputTypeForColumn(COLS[1])).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("OPERATOR_LABELS covers all 13 operators", () => {
    expect(Object.keys(OPERATOR_LABELS)).toHaveLength(13);
  });

  it("NULL_OPERATORS contains IsNull and IsNotNull", () => {
    expect(NULL_OPERATORS.has(FilterOperator.IsNull)).toBe(true);
    expect(NULL_OPERATORS.has(FilterOperator.IsNotNull)).toBe(true);
    expect(NULL_OPERATORS.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests for data-grid helpers — pure functions
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  ColumnType,
  FormatHintKind,
  FilterCombinator,
  FilterOperator,
} from "../src/types/index.js";
import type { ColumnMeta } from "../src/types/columns.js";
import type { FilterGroup } from "../src/types/filters.js";
import type { DynamicReportDefinition } from "../src/types/reports.js";
import type { PivotResultColDef } from "../src/types/ssrm.js";
import { AggFunc } from "../src/types/ssrm.js";
import type { SSRMGetRowsParams } from "../src/data-grid/helpers.js";
import {
  columnMetaToColDef,
  tableColDefs,
  pivotSecondaryColDefs,
  buildTableRequest,
  buildPivotRequest,
  hasFilter,
  isPivotReady,
} from "../src/data-grid/helpers.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeColumn(overrides: Partial<ColumnMeta> = {}): ColumnMeta {
  return {
    name: "amount",
    label: "Amount",
    type: ColumnType.Number,
    operators: [FilterOperator.Equals],
    nullable: false,
    ...overrides,
  };
}

function makeDefinition(
  overrides: Partial<DynamicReportDefinition> = {},
): DynamicReportDefinition {
  return {
    datasetKey: "orders",
    selectedColumns: ["order_id", "customer", "amount"],
    filter: { combinator: FilterCombinator.And },
    ...overrides,
  };
}

function makeSSRMParams(overrides: Partial<SSRMGetRowsParams["request"]> = {}): SSRMGetRowsParams {
  return {
    request: {
      startRow: 0,
      endRow: 100,
      rowGroupCols: [],
      groupKeys: [],
      valueCols: [],
      sortModel: [],
      ...overrides,
    },
    success: () => {},
    fail: () => {},
  };
}

// ---------------------------------------------------------------------------
// columnMetaToColDef
// ---------------------------------------------------------------------------

describe("columnMetaToColDef", () => {
  it("maps basic column", () => {
    const col = makeColumn({ name: "name", label: "Name", type: ColumnType.String });
    const def = columnMetaToColDef(col);
    expect(def.colId).toBe("name");
    expect(def.field).toBe("name");
    expect(def.headerName).toBe("Name");
    expect(def.type).toBeUndefined(); // strings have no AG Grid type
  });

  it("marks numeric columns", () => {
    const col = makeColumn({ type: ColumnType.Number });
    expect(columnMetaToColDef(col).type).toBe("numericColumn");
  });

  it("marks currency as numeric", () => {
    const col = makeColumn({ type: ColumnType.Currency });
    expect(columnMetaToColDef(col).type).toBe("numericColumn");
  });

  it("marks percentage as numeric", () => {
    const col = makeColumn({ type: ColumnType.Percentage });
    expect(columnMetaToColDef(col).type).toBe("numericColumn");
  });

  it("marks date columns", () => {
    const col = makeColumn({ type: ColumnType.Date });
    expect(columnMetaToColDef(col).type).toBe("dateColumn");
  });

  it("marks datetime columns", () => {
    const col = makeColumn({ type: ColumnType.Datetime });
    expect(columnMetaToColDef(col).type).toBe("dateColumn");
  });

  it("applies currency format expression", () => {
    const col = makeColumn({
      type: ColumnType.Currency,
      formatHints: { kind: FormatHintKind.Currency, currencyCode: "EUR", decimals: 2 },
    });
    const def = columnMetaToColDef(col);
    expect(def.valueFormatter).toBeDefined();
    expect(def.valueFormatter).toContain("EUR");
    expect(def.valueFormatter).toContain("currency");
  });

  it("applies percentage format expression", () => {
    const col = makeColumn({
      type: ColumnType.Percentage,
      formatHints: { kind: FormatHintKind.Percentage, decimals: 1 },
    });
    const def = columnMetaToColDef(col);
    expect(def.valueFormatter).toContain("100");
    expect(def.valueFormatter).toContain("%");
  });

  it("applies number format expression", () => {
    const col = makeColumn({
      formatHints: { kind: FormatHintKind.Number, decimals: 3 },
    });
    const def = columnMetaToColDef(col);
    expect(def.valueFormatter).toBeDefined();
    expect(def.valueFormatter).toContain("3");
  });

  it("applies integer format expression", () => {
    const col = makeColumn({
      formatHints: { kind: FormatHintKind.Integer },
    });
    const def = columnMetaToColDef(col);
    expect(def.valueFormatter).toContain("maximumFractionDigits: 0");
  });

  it("applies date format expression", () => {
    const col = makeColumn({
      type: ColumnType.Date,
      formatHints: { kind: FormatHintKind.Date },
    });
    const def = columnMetaToColDef(col);
    expect(def.valueFormatter).toContain("toLocaleDateString");
  });

  it("applies datetime format expression", () => {
    const col = makeColumn({
      type: ColumnType.Datetime,
      formatHints: { kind: FormatHintKind.Datetime },
    });
    const def = columnMetaToColDef(col);
    expect(def.valueFormatter).toContain("toLocaleString");
  });

  it("uses USD default for currency without currencyCode", () => {
    const col = makeColumn({
      formatHints: { kind: FormatHintKind.Currency },
    });
    const def = columnMetaToColDef(col);
    expect(def.valueFormatter).toContain("USD");
  });

  it("no valueFormatter for string format hint", () => {
    const col = makeColumn({
      formatHints: { kind: FormatHintKind.String },
    });
    const def = columnMetaToColDef(col);
    expect(def.valueFormatter).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// tableColDefs
// ---------------------------------------------------------------------------

describe("tableColDefs", () => {
  const columns: ColumnMeta[] = [
    makeColumn({ name: "order_id", label: "Order ID", type: ColumnType.Number }),
    makeColumn({ name: "customer", label: "Customer", type: ColumnType.String }),
    makeColumn({ name: "amount", label: "Amount", type: ColumnType.Currency }),
    makeColumn({ name: "hidden", label: "Hidden Col", type: ColumnType.String }),
  ];

  it("returns only selected columns in definition order", () => {
    const def = makeDefinition({
      selectedColumns: ["amount", "order_id"],
    });
    const defs = tableColDefs(def, columns);
    expect(defs).toHaveLength(2);
    expect(defs[0].colId).toBe("amount");
    expect(defs[1].colId).toBe("order_id");
  });

  it("uses column name as fallback for unknown columns", () => {
    const def = makeDefinition({
      selectedColumns: ["unknown_col"],
    });
    const defs = tableColDefs(def, columns);
    expect(defs).toHaveLength(1);
    expect(defs[0].colId).toBe("unknown_col");
    expect(defs[0].headerName).toBe("unknown_col");
  });

  it("returns empty for no selected columns", () => {
    const def = makeDefinition({ selectedColumns: [] });
    expect(tableColDefs(def, columns)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// pivotSecondaryColDefs
// ---------------------------------------------------------------------------

describe("pivotSecondaryColDefs", () => {
  it("converts flat server cols", () => {
    const serverCols: PivotResultColDef[] = [
      {
        colId: "usa_sum_amount",
        headerName: "USA - Sum(Amount)",
        field: "usa_sum_amount",
        pivotMeta: { pivotKeys: ["USA"], measure: "amount", agg: "sum" },
      },
    ];
    const result = pivotSecondaryColDefs(serverCols);
    expect(result).toHaveLength(1);
    expect(result[0].colId).toBe("usa_sum_amount");
    expect(result[0].pivotKeys).toEqual(["USA"]);
    expect(result[0].aggFunc).toBe("sum");
  });

  it("converts nested (grouped) cols", () => {
    const serverCols: PivotResultColDef[] = [
      {
        colId: "usa",
        headerName: "USA",
        field: "",
        children: [
          {
            colId: "usa_sum_amount",
            headerName: "Sum(Amount)",
            field: "usa_sum_amount",
            pivotMeta: { agg: "sum" },
          },
        ],
      },
    ];
    const result = pivotSecondaryColDefs(serverCols);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].aggFunc).toBe("sum");
  });

  it("handles empty input", () => {
    expect(pivotSecondaryColDefs([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildTableRequest
// ---------------------------------------------------------------------------

describe("buildTableRequest", () => {
  it("builds request from definition + params", () => {
    const def = makeDefinition({
      filter: {
        combinator: FilterCombinator.And,
        conditions: [
          { column: "amount", operator: FilterOperator.GreaterThan, value: 100 },
        ],
      },
    });
    const params = makeSSRMParams({ startRow: 50, endRow: 150 });
    const req = buildTableRequest(params, def);
    expect(req.startRow).toBe(50);
    expect(req.endRow).toBe(150);
    expect(req.filter).toBeDefined();
  });

  it("uses definition rowGroupCols over params", () => {
    const def = makeDefinition({
      rowGroupCols: [{ id: "category", displayName: "Category" }],
    });
    const params = makeSSRMParams({
      rowGroupCols: [{ id: "other", displayName: "Other" }],
    });
    const req = buildTableRequest(params, def);
    expect(req.rowGroupCols).toEqual([{ id: "category", displayName: "Category" }]);
  });

  it("falls back to params rowGroupCols when definition has none", () => {
    const def = makeDefinition();
    const params = makeSSRMParams({
      rowGroupCols: [{ id: "from_grid", displayName: "From Grid" }],
    });
    const req = buildTableRequest(params, def);
    expect(req.rowGroupCols).toEqual([{ id: "from_grid", displayName: "From Grid" }]);
  });

  it("omits filter when FilterGroup is empty", () => {
    const def = makeDefinition({
      filter: { combinator: FilterCombinator.And },
    });
    const params = makeSSRMParams();
    const req = buildTableRequest(params, def);
    expect(req.filter).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildPivotRequest
// ---------------------------------------------------------------------------

describe("buildPivotRequest", () => {
  it("sets pivotMode and pivotCols from definition", () => {
    const def = makeDefinition({
      pivotCols: [{ id: "country", displayName: "Country" }],
      rowGroupCols: [{ id: "category", displayName: "Category" }],
      valueCols: [{ id: "amount", displayName: "Amount", aggFunc: AggFunc.Sum }],
    });
    const params = makeSSRMParams();
    const req = buildPivotRequest(params, def);
    expect(req.pivotMode).toBe(true);
    expect(req.pivotCols).toEqual(def.pivotCols);
    expect(req.rowGroupCols).toEqual(def.rowGroupCols);
    expect(req.valueCols).toEqual(def.valueCols);
  });
});

// ---------------------------------------------------------------------------
// hasFilter
// ---------------------------------------------------------------------------

describe("hasFilter", () => {
  it("returns false for null", () => {
    expect(hasFilter(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasFilter(undefined)).toBe(false);
  });

  it("returns false for empty group", () => {
    expect(hasFilter({ combinator: FilterCombinator.And })).toBe(false);
  });

  it("returns true when conditions present", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      conditions: [
        { column: "x", operator: FilterOperator.Equals, value: 1 },
      ],
    };
    expect(hasFilter(fg)).toBe(true);
  });

  it("returns true when nested groups present", () => {
    const fg: FilterGroup = {
      combinator: FilterCombinator.And,
      groups: [{ combinator: FilterCombinator.Or }],
    };
    expect(hasFilter(fg)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isPivotReady
// ---------------------------------------------------------------------------

describe("isPivotReady", () => {
  it("returns false for null", () => {
    expect(isPivotReady(null)).toBe(false);
  });

  it("returns false with no rowGroupCols", () => {
    const def = makeDefinition({ valueCols: [{ id: "x", displayName: "X" }] });
    expect(isPivotReady(def)).toBe(false);
  });

  it("returns false with no valueCols", () => {
    const def = makeDefinition({
      rowGroupCols: [{ id: "x", displayName: "X" }],
    });
    expect(isPivotReady(def)).toBe(false);
  });

  it("returns true with both rowGroupCols and valueCols", () => {
    const def = makeDefinition({
      rowGroupCols: [{ id: "cat", displayName: "Category" }],
      valueCols: [{ id: "amount", displayName: "Amount", aggFunc: AggFunc.Sum }],
    });
    expect(isPivotReady(def)).toBe(true);
  });
});

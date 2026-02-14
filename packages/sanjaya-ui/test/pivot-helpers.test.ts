// ---------------------------------------------------------------------------
// Tests for pivot-config/helpers.ts — pure functions, no DOM
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { ColumnType } from "../src/types/columns.js";
import type { ColumnMeta } from "../src/types/columns.js";
import { AggFunc } from "../src/types/ssrm.js";
import type { ColumnVO } from "../src/types/ssrm.js";
import {
  emptyPivotConfig,
  columnVOFromMeta,
  availableDimensions,
  availableMeasures,
  unplacedDimensions,
  unplacedMeasures,
  colsForZone,
  withZoneCols,
  addToZone,
  removeFromZone,
  reorderInZone,
  updateAggFunc,
  AGG_LABELS,
} from "../src/pivot-config/helpers.js";
import type { PivotConfig } from "../src/pivot-config/helpers.js";
import { FilterOperator } from "../src/types/filters.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const dimCol = (name: string, label?: string): ColumnMeta => ({
  name,
  label: label ?? name,
  type: ColumnType.String,
  operators: [FilterOperator.Eq],
  nullable: false,
  pivot: { role: "dimension" },
});

const measCol = (
  name: string,
  label?: string,
  allowedAggs?: Array<{ agg: AggFunc; label: string }>,
): ColumnMeta => ({
  name,
  label: label ?? name,
  type: ColumnType.Number,
  operators: [FilterOperator.Eq],
  nullable: false,
  pivot: {
    role: "measure",
    allowedAggs: allowedAggs ?? [
      { agg: AggFunc.Sum, label: "Sum" },
      { agg: AggFunc.Avg, label: "Average" },
    ],
  },
});

const noPivotCol = (name: string): ColumnMeta => ({
  name,
  label: name,
  type: ColumnType.String,
  operators: [FilterOperator.Eq],
  nullable: false,
});

const COLS: ColumnMeta[] = [
  dimCol("region", "Region"),
  dimCol("year", "Year"),
  measCol("revenue", "Revenue"),
  measCol("cost", "Cost"),
  noPivotCol("notes"),
];

const vo = (id: string, aggFunc?: AggFunc): ColumnVO => ({
  id,
  displayName: id,
  field: id,
  ...(aggFunc !== undefined ? { aggFunc } : {}),
});

// ---------------------------------------------------------------------------
// AGG_LABELS
// ---------------------------------------------------------------------------

describe("AGG_LABELS", () => {
  it("has entries for all AggFunc values", () => {
    for (const key of Object.values(AggFunc)) {
      expect(AGG_LABELS[key]).toBeTruthy();
    }
  });

  it("maps Sum correctly", () => {
    expect(AGG_LABELS[AggFunc.Sum]).toBe("Sum");
  });

  it("maps DistinctCount correctly", () => {
    expect(AGG_LABELS[AggFunc.DistinctCount]).toBe("Distinct Count");
  });
});

// ---------------------------------------------------------------------------
// emptyPivotConfig
// ---------------------------------------------------------------------------

describe("emptyPivotConfig", () => {
  it("returns an object with three empty arrays", () => {
    const cfg = emptyPivotConfig();
    expect(cfg).toEqual({
      rowGroupCols: [],
      pivotCols: [],
      valueCols: [],
    });
  });

  it("returns distinct instances on each call", () => {
    const a = emptyPivotConfig();
    const b = emptyPivotConfig();
    expect(a).not.toBe(b);
    expect(a.rowGroupCols).not.toBe(b.rowGroupCols);
  });
});

// ---------------------------------------------------------------------------
// columnVOFromMeta
// ---------------------------------------------------------------------------

describe("columnVOFromMeta", () => {
  it("creates a ColumnVO from a dimension column (no aggFunc)", () => {
    const result = columnVOFromMeta(dimCol("region", "Region"));
    expect(result).toEqual({
      id: "region",
      displayName: "Region",
      field: "region",
    });
    expect(result.aggFunc).toBeUndefined();
  });

  it("creates a ColumnVO from a measure column with default agg", () => {
    const result = columnVOFromMeta(measCol("revenue", "Revenue"));
    expect(result.aggFunc).toBe(AggFunc.Sum);
  });

  it("uses the provided aggFunc override", () => {
    const result = columnVOFromMeta(
      measCol("revenue", "Revenue"),
      AggFunc.Max,
    );
    expect(result.aggFunc).toBe(AggFunc.Max);
  });

  it("defaults to Sum when no allowedAggs are specified", () => {
    const col: ColumnMeta = {
      ...measCol("x", "X"),
      pivot: { role: "measure" },
    };
    const result = columnVOFromMeta(col);
    expect(result.aggFunc).toBe(AggFunc.Sum);
  });

  it("picks first allowedAgg when available", () => {
    const col = measCol("x", "X", [
      { agg: AggFunc.Avg, label: "Average" },
      { agg: AggFunc.Min, label: "Min" },
    ]);
    const result = columnVOFromMeta(col);
    expect(result.aggFunc).toBe(AggFunc.Avg);
  });
});

// ---------------------------------------------------------------------------
// availableDimensions / availableMeasures
// ---------------------------------------------------------------------------

describe("availableDimensions", () => {
  it("returns only dimension columns", () => {
    const result = availableDimensions(COLS);
    expect(result.map((c) => c.name)).toEqual(["region", "year"]);
  });

  it("returns empty for columns with no pivot role", () => {
    expect(availableDimensions([noPivotCol("a")])).toEqual([]);
  });
});

describe("availableMeasures", () => {
  it("returns only measure columns", () => {
    const result = availableMeasures(COLS);
    expect(result.map((c) => c.name)).toEqual(["revenue", "cost"]);
  });

  it("returns empty for columns with no pivot role", () => {
    expect(availableMeasures([noPivotCol("a")])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// unplacedDimensions / unplacedMeasures
// ---------------------------------------------------------------------------

describe("unplacedDimensions", () => {
  it("returns all dimensions when config is empty", () => {
    const result = unplacedDimensions(COLS, emptyPivotConfig());
    expect(result.map((c) => c.name)).toEqual(["region", "year"]);
  });

  it("excludes dimensions placed in rows", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      rowGroupCols: [vo("region")],
    };
    const result = unplacedDimensions(COLS, cfg);
    expect(result.map((c) => c.name)).toEqual(["year"]);
  });

  it("excludes dimensions placed in columns", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      pivotCols: [vo("year")],
    };
    const result = unplacedDimensions(COLS, cfg);
    expect(result.map((c) => c.name)).toEqual(["region"]);
  });

  it("excludes dimensions placed in both zones", () => {
    const cfg: PivotConfig = {
      rowGroupCols: [vo("region")],
      pivotCols: [vo("year")],
      valueCols: [],
    };
    const result = unplacedDimensions(COLS, cfg);
    expect(result).toEqual([]);
  });
});

describe("unplacedMeasures", () => {
  it("returns all measures when config is empty", () => {
    const result = unplacedMeasures(COLS, emptyPivotConfig());
    expect(result.map((c) => c.name)).toEqual(["revenue", "cost"]);
  });

  it("excludes measures placed in values", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      valueCols: [vo("revenue", AggFunc.Sum)],
    };
    const result = unplacedMeasures(COLS, cfg);
    expect(result.map((c) => c.name)).toEqual(["cost"]);
  });
});

// ---------------------------------------------------------------------------
// colsForZone / withZoneCols
// ---------------------------------------------------------------------------

describe("colsForZone", () => {
  it("returns rowGroupCols for 'rows'", () => {
    const cfg: PivotConfig = {
      rowGroupCols: [vo("a")],
      pivotCols: [vo("b")],
      valueCols: [vo("c")],
    };
    expect(colsForZone(cfg, "rows")).toBe(cfg.rowGroupCols);
  });

  it("returns pivotCols for 'columns'", () => {
    const cfg: PivotConfig = {
      rowGroupCols: [vo("a")],
      pivotCols: [vo("b")],
      valueCols: [vo("c")],
    };
    expect(colsForZone(cfg, "columns")).toBe(cfg.pivotCols);
  });

  it("returns valueCols for 'values'", () => {
    const cfg: PivotConfig = {
      rowGroupCols: [vo("a")],
      pivotCols: [vo("b")],
      valueCols: [vo("c")],
    };
    expect(colsForZone(cfg, "values")).toBe(cfg.valueCols);
  });
});

describe("withZoneCols", () => {
  it("replaces rowGroupCols for 'rows'", () => {
    const cfg = emptyPivotConfig();
    const next = withZoneCols(cfg, "rows", [vo("x")]);
    expect(next.rowGroupCols).toEqual([vo("x")]);
    // Original unchanged
    expect(cfg.rowGroupCols).toEqual([]);
  });

  it("replaces pivotCols for 'columns'", () => {
    const next = withZoneCols(emptyPivotConfig(), "columns", [vo("y")]);
    expect(next.pivotCols).toEqual([vo("y")]);
  });

  it("replaces valueCols for 'values'", () => {
    const next = withZoneCols(emptyPivotConfig(), "values", [
      vo("z", AggFunc.Sum),
    ]);
    expect(next.valueCols).toEqual([vo("z", AggFunc.Sum)]);
  });
});

// ---------------------------------------------------------------------------
// addToZone
// ---------------------------------------------------------------------------

describe("addToZone", () => {
  it("adds a column to rows", () => {
    const next = addToZone(emptyPivotConfig(), "rows", vo("region"));
    expect(next.rowGroupCols).toEqual([vo("region")]);
  });

  it("adds a column to columns", () => {
    const next = addToZone(emptyPivotConfig(), "columns", vo("year"));
    expect(next.pivotCols).toEqual([vo("year")]);
  });

  it("adds a column to values", () => {
    const next = addToZone(
      emptyPivotConfig(),
      "values",
      vo("revenue", AggFunc.Sum),
    );
    expect(next.valueCols).toEqual([vo("revenue", AggFunc.Sum)]);
  });

  it("does not duplicate an existing column", () => {
    const cfg = addToZone(emptyPivotConfig(), "rows", vo("region"));
    const next = addToZone(cfg, "rows", vo("region"));
    expect(next.rowGroupCols).toHaveLength(1);
  });

  it("enforces dimension exclusivity: adding to rows removes from columns", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      pivotCols: [vo("region")],
    };
    const next = addToZone(cfg, "rows", vo("region"));
    expect(next.rowGroupCols).toEqual([vo("region")]);
    expect(next.pivotCols).toEqual([]);
  });

  it("enforces dimension exclusivity: adding to columns removes from rows", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      rowGroupCols: [vo("year")],
    };
    const next = addToZone(cfg, "columns", vo("year"));
    expect(next.pivotCols).toEqual([vo("year")]);
    expect(next.rowGroupCols).toEqual([]);
  });

  it("does not mutate the original config", () => {
    const cfg = emptyPivotConfig();
    addToZone(cfg, "rows", vo("x"));
    expect(cfg.rowGroupCols).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// removeFromZone
// ---------------------------------------------------------------------------

describe("removeFromZone", () => {
  it("removes a column from rows", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      rowGroupCols: [vo("a"), vo("b")],
    };
    const next = removeFromZone(cfg, "rows", "a");
    expect(next.rowGroupCols.map((c) => c.id)).toEqual(["b"]);
  });

  it("removes a column from columns", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      pivotCols: [vo("a")],
    };
    const next = removeFromZone(cfg, "columns", "a");
    expect(next.pivotCols).toEqual([]);
  });

  it("removes a column from values", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      valueCols: [vo("a", AggFunc.Sum), vo("b", AggFunc.Avg)],
    };
    const next = removeFromZone(cfg, "values", "b");
    expect(next.valueCols.map((c) => c.id)).toEqual(["a"]);
  });

  it("is a no-op when column is not present", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      rowGroupCols: [vo("a")],
    };
    const next = removeFromZone(cfg, "rows", "nonexistent");
    expect(next.rowGroupCols).toEqual([vo("a")]);
  });

  it("does not mutate the original config", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      rowGroupCols: [vo("a")],
    };
    removeFromZone(cfg, "rows", "a");
    expect(cfg.rowGroupCols).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// reorderInZone
// ---------------------------------------------------------------------------

describe("reorderInZone", () => {
  it("moves a column forward", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      rowGroupCols: [vo("a"), vo("b"), vo("c")],
    };
    const next = reorderInZone(cfg, "rows", 0, 2);
    expect(next.rowGroupCols.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("moves a column backward", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      rowGroupCols: [vo("a"), vo("b"), vo("c")],
    };
    const next = reorderInZone(cfg, "rows", 2, 0);
    expect(next.rowGroupCols.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("returns the same config when fromIdx === toIdx", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      rowGroupCols: [vo("a"), vo("b")],
    };
    const next = reorderInZone(cfg, "rows", 1, 1);
    expect(next).toBe(cfg); // identity — no clone needed
  });

  it("does not mutate the original config", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      pivotCols: [vo("a"), vo("b"), vo("c")],
    };
    reorderInZone(cfg, "columns", 0, 2);
    expect(cfg.pivotCols.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// updateAggFunc
// ---------------------------------------------------------------------------

describe("updateAggFunc", () => {
  it("updates the aggFunc for a value column", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      valueCols: [vo("revenue", AggFunc.Sum)],
    };
    const next = updateAggFunc(cfg, "revenue", AggFunc.Avg);
    expect(next.valueCols[0].aggFunc).toBe(AggFunc.Avg);
  });

  it("is a no-op if colId is not in values", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      valueCols: [vo("revenue", AggFunc.Sum)],
    };
    const next = updateAggFunc(cfg, "nonexistent", AggFunc.Max);
    expect(next.valueCols).toEqual([vo("revenue", AggFunc.Sum)]);
  });

  it("does not mutate the original config", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      valueCols: [vo("revenue", AggFunc.Sum)],
    };
    updateAggFunc(cfg, "revenue", AggFunc.Avg);
    expect(cfg.valueCols[0].aggFunc).toBe(AggFunc.Sum);
  });

  it("handles multiple value columns", () => {
    const cfg: PivotConfig = {
      ...emptyPivotConfig(),
      valueCols: [vo("a", AggFunc.Sum), vo("b", AggFunc.Avg)],
    };
    const next = updateAggFunc(cfg, "b", AggFunc.Max);
    expect(next.valueCols[0].aggFunc).toBe(AggFunc.Sum); // unchanged
    expect(next.valueCols[1].aggFunc).toBe(AggFunc.Max); // updated
  });
});

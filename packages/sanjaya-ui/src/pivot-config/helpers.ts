// ---------------------------------------------------------------------------
// Pivot-config shared types, constants, and pure helper functions
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "../types/columns.js";
import type { ColumnVO } from "../types/ssrm.js";
import { AggFunc } from "../types/ssrm.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Which zone a column can be placed in.
 *
 * - `"rows"` — row-group dimensions (left-axis)
 * - `"columns"` — cross-tab pivot dimensions (top-axis)
 * - `"values"` — aggregated measures
 */
export type PivotZone = "rows" | "columns" | "values";

/**
 * The complete pivot layout state tracked by `<sj-pivot-config>`.
 */
export interface PivotConfig {
  rowGroupCols: ColumnVO[];
  pivotCols: ColumnVO[];
  valueCols: ColumnVO[]; // each must have aggFunc set
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Human-readable labels for aggregate functions. */
export const AGG_LABELS: Record<string, string> = {
  [AggFunc.Sum]: "Sum",
  [AggFunc.Avg]: "Average",
  [AggFunc.Min]: "Min",
  [AggFunc.Max]: "Max",
  [AggFunc.Count]: "Count",
  [AggFunc.DistinctCount]: "Distinct Count",
  [AggFunc.First]: "First",
  [AggFunc.Last]: "Last",
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Create an empty pivot config. */
export function emptyPivotConfig(): PivotConfig {
  return { rowGroupCols: [], pivotCols: [], valueCols: [] };
}

/**
 * Build a `ColumnVO` from column metadata.
 *
 * For measures, defaults `aggFunc` to the first allowed agg (or `sum`).
 */
export function columnVOFromMeta(
  col: ColumnMeta,
  aggFunc?: AggFunc,
): ColumnVO {
  const vo: ColumnVO = {
    id: col.name,
    displayName: col.label,
    field: col.name,
  };
  if (col.pivot?.role === "measure") {
    vo.aggFunc =
      aggFunc ??
      col.pivot.allowedAggs?.[0]?.agg ??
      AggFunc.Sum;
  }
  return vo;
}

/**
 * Get columns available for dimension zones (Rows / Columns).
 *
 * Returns only columns whose `pivot.role === "dimension"`.
 */
export function availableDimensions(columns: ColumnMeta[]): ColumnMeta[] {
  return columns.filter((c) => c.pivot?.role === "dimension");
}

/**
 * Get columns available for the Values zone.
 *
 * Returns only columns whose `pivot.role === "measure"`.
 */
export function availableMeasures(columns: ColumnMeta[]): ColumnMeta[] {
  return columns.filter((c) => c.pivot?.role === "measure");
}

/**
 * Get dimension columns that are not already placed in Rows or Columns.
 */
export function unplacedDimensions(
  columns: ColumnMeta[],
  config: PivotConfig,
): ColumnMeta[] {
  const placed = new Set<string>([
    ...config.rowGroupCols.map((c) => c.id),
    ...config.pivotCols.map((c) => c.id),
  ]);
  return availableDimensions(columns).filter((c) => !placed.has(c.name));
}

/**
 * Get measure columns that are not already placed in Values.
 */
export function unplacedMeasures(
  columns: ColumnMeta[],
  config: PivotConfig,
): ColumnMeta[] {
  const placed = new Set(config.valueCols.map((c) => c.id));
  return availableMeasures(columns).filter((c) => !placed.has(c.name));
}

/**
 * Get the list of ColumnVOs for a given zone.
 */
export function colsForZone(
  config: PivotConfig,
  zone: PivotZone,
): ColumnVO[] {
  switch (zone) {
    case "rows":
      return config.rowGroupCols;
    case "columns":
      return config.pivotCols;
    case "values":
      return config.valueCols;
  }
}

/**
 * Return a new PivotConfig with the given zone's columns replaced.
 */
export function withZoneCols(
  config: PivotConfig,
  zone: PivotZone,
  cols: ColumnVO[],
): PivotConfig {
  const next = structuredClone(config);
  switch (zone) {
    case "rows":
      next.rowGroupCols = cols;
      break;
    case "columns":
      next.pivotCols = cols;
      break;
    case "values":
      next.valueCols = cols;
      break;
  }
  return next;
}

/**
 * Add a column to a zone. Returns the updated PivotConfig.
 *
 * If the column is a dimension being added to Rows or Columns, it is
 * automatically removed from the other dimension zone (exclusivity rule).
 */
export function addToZone(
  config: PivotConfig,
  zone: PivotZone,
  vo: ColumnVO,
): PivotConfig {
  let next = structuredClone(config);

  // Dimension exclusivity: remove from the other zone
  if (zone === "rows") {
    next.pivotCols = next.pivotCols.filter((c) => c.id !== vo.id);
  } else if (zone === "columns") {
    next.rowGroupCols = next.rowGroupCols.filter((c) => c.id !== vo.id);
  }

  // Don't duplicate
  const target = colsForZone(next, zone);
  if (!target.some((c) => c.id === vo.id)) {
    target.push(vo);
  }

  return next;
}

/**
 * Remove a column from a zone. Returns the updated PivotConfig.
 */
export function removeFromZone(
  config: PivotConfig,
  zone: PivotZone,
  colId: string,
): PivotConfig {
  const next = structuredClone(config);
  switch (zone) {
    case "rows":
      next.rowGroupCols = next.rowGroupCols.filter((c) => c.id !== colId);
      break;
    case "columns":
      next.pivotCols = next.pivotCols.filter((c) => c.id !== colId);
      break;
    case "values":
      next.valueCols = next.valueCols.filter((c) => c.id !== colId);
      break;
  }
  return next;
}

/**
 * Move a column within a zone (reorder). Returns the updated PivotConfig.
 */
export function reorderInZone(
  config: PivotConfig,
  zone: PivotZone,
  fromIdx: number,
  toIdx: number,
): PivotConfig {
  if (fromIdx === toIdx) return config;
  const next = structuredClone(config);
  const cols = colsForZone(next, zone);
  const [moved] = cols.splice(fromIdx, 1);
  cols.splice(toIdx, 0, moved);
  return next;
}

/**
 * Update the aggFunc for a column in the Values zone.
 * Returns the updated PivotConfig.
 */
export function updateAggFunc(
  config: PivotConfig,
  colId: string,
  aggFunc: AggFunc,
): PivotConfig {
  const next = structuredClone(config);
  const col = next.valueCols.find((c) => c.id === colId);
  if (col) {
    col.aggFunc = aggFunc;
  }
  return next;
}

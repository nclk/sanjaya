// ---------------------------------------------------------------------------
// Filter-builder shared types, constants, and pure helper functions
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "../types/columns.js";
import { ColumnType } from "../types/columns.js";
import {
  FilterOperator,
  FilterCombinator,
} from "../types/filters.js";
import type { FilterCondition, FilterGroup } from "../types/filters.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A condition row in basic mode — includes the "ALL" pseudo-operator. */
export interface BasicRow {
  column: string;
  operator: string; // FilterOperator value or "ALL"
  value: unknown;
  valueTo?: unknown; // second value for "between"
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Operator labels for human-readable dropdowns. */
export const OPERATOR_LABELS: Record<string, string> = {
  [FilterOperator.Eq]: "equals",
  [FilterOperator.Neq]: "not equals",
  [FilterOperator.Gt]: "greater than",
  [FilterOperator.Lt]: "less than",
  [FilterOperator.Gte]: "greater or equal",
  [FilterOperator.Lte]: "less or equal",
  [FilterOperator.Contains]: "contains",
  [FilterOperator.StartsWith]: "starts with",
  [FilterOperator.EndsWith]: "ends with",
  [FilterOperator.IsNull]: "is empty",
  [FilterOperator.IsNotNull]: "is not empty",
  [FilterOperator.Between]: "between",
  [FilterOperator.In]: "is one of",
};

/** Operators that need no value input. */
export const NULL_OPERATORS = new Set<string>([
  FilterOperator.IsNull,
  FilterOperator.IsNotNull,
]);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Create a fresh ALL-operator basic row for a given column. */
export function emptyBasicRow(columnName: string): BasicRow {
  return { column: columnName, operator: "ALL", value: undefined };
}

/**
 * Convert basic rows to a FilterGroup (only non-ALL rows included).
 */
export function basicRowsToFilterGroup(rows: BasicRow[]): FilterGroup {
  const conditions: FilterCondition[] = [];
  for (const row of rows) {
    if (row.operator === "ALL") continue;
    const cond: FilterCondition = {
      column: row.column,
      operator: row.operator as FilterOperator,
    };
    if (row.operator === FilterOperator.Between) {
      cond.value = [row.value, row.valueTo];
    } else if (row.operator === FilterOperator.In) {
      // Parse comma-separated string into array
      cond.value =
        typeof row.value === "string"
          ? row.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : row.value;
    } else if (!NULL_OPERATORS.has(row.operator)) {
      cond.value = row.value;
    }
    conditions.push(cond);
  }
  return { combinator: FilterCombinator.And, conditions, groups: [] };
}

/**
 * Convert a FilterGroup back to basic rows. Only works for flat AND groups
 * (no nested groups, no OR, no group-level NOT). Missing columns get an
 * "ALL" row.
 */
export function filterGroupToBasicRows(
  group: FilterGroup,
  columns: ColumnMeta[],
): BasicRow[] {
  const condMap = new Map<string, FilterCondition>();
  for (const c of group.conditions ?? []) {
    condMap.set(c.column, c);
  }
  return columns.map((col) => {
    const cond = condMap.get(col.name);
    if (!cond) return emptyBasicRow(col.name);
    const row: BasicRow = {
      column: cond.column,
      operator: cond.operator,
      value: undefined,
    };
    if (cond.operator === FilterOperator.Between && Array.isArray(cond.value)) {
      row.value = cond.value[0];
      row.valueTo = cond.value[1];
    } else if (!NULL_OPERATORS.has(cond.operator)) {
      row.value =
        cond.operator === FilterOperator.In && Array.isArray(cond.value)
          ? cond.value.join(", ")
          : cond.value;
    }
    return row;
  });
}

/**
 * Check if a FilterGroup is representable in basic mode (flat AND, no
 * nested groups, no group-level NOT, no per-condition NOT).
 */
export function isBasicCompatible(group: FilterGroup): boolean {
  if (group.combinator !== FilterCombinator.And) return false;
  if (group.not) return false;
  if (group.groups && group.groups.length > 0) return false;
  if (group.conditions?.some((c) => c.not)) return false;
  return true;
}

/**
 * Determine the HTML input type for a given column type.
 */
export function inputTypeForColumn(col: ColumnMeta): string {
  switch (col.type) {
    case ColumnType.Number:
    case ColumnType.Currency:
    case ColumnType.Percentage:
      return "number";
    case ColumnType.Date:
      return "date";
    case ColumnType.Datetime:
      return "datetime-local";
    default:
      return "text";
  }
}

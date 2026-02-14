// ---------------------------------------------------------------------------
// Filter types — mirror sanjaya_core.filters and sanjaya_core.enums
// ---------------------------------------------------------------------------

/**
 * Operators available inside a filter condition.
 *
 * Values match the AG Grid / Sanjaya wire format and align with
 * `sanjaya_core.enums.FilterOperator`.
 */
export enum FilterOperator {
  Eq = "eq",
  Neq = "neq",
  Gt = "gt",
  Lt = "lt",
  Gte = "gte",
  Lte = "lte",
  Contains = "contains",
  StartsWith = "startswith",
  EndsWith = "endswith",
  IsNull = "isNull",
  IsNotNull = "isNotNull",
  Between = "between",
  In = "in",
}

/**
 * Logical combinator for filter groups.
 */
export enum FilterCombinator {
  And = "and",
  Or = "or",
}

/**
 * UI hint for how a column should be filtered.
 */
export enum FilterStyle {
  /** Standard operator-based filter input. */
  Operators = "operators",
  /** Multi-select list — implies the `in` operator. */
  Select = "select",
}

// ---------------------------------------------------------------------------
// Filter models
// ---------------------------------------------------------------------------

/**
 * A single predicate: `column <operator> value`.
 *
 * Matches the sanjaya-core `FilterCondition` wire format. The `not` field
 * maps to `negate` on the Python side (where `not` is a reserved word).
 */
export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value?: unknown;
  /** Negate this condition. Serialized as `"not"` on the wire. */
  not?: boolean;
}

/**
 * A recursive boolean group of filter conditions.
 *
 * Matches the sanjaya-core `FilterGroup` wire format.
 */
export interface FilterGroup {
  combinator: FilterCombinator;
  /** Negate the entire group. Serialized as `"not"` on the wire. */
  not?: boolean;
  conditions?: FilterCondition[];
  groups?: FilterGroup[];
}

/**
 * Create an empty filter group with sensible defaults.
 */
export function emptyFilterGroup(): FilterGroup {
  return {
    combinator: FilterCombinator.And,
    conditions: [],
    groups: [],
  };
}

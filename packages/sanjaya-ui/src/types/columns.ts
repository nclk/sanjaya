// ---------------------------------------------------------------------------
// Enumerations — mirror sanjaya-core enums and TypeSpec definitions
// ---------------------------------------------------------------------------

/**
 * Data types a dataset column can have.
 *
 * @see sanjaya_core.enums.ColumnType
 */
export enum ColumnType {
  String = "string",
  Number = "number",
  Currency = "currency",
  Percentage = "percentage",
  Date = "date",
  Datetime = "datetime",
  Boolean = "boolean",
}

/**
 * Business-oriented format kinds for cell rendering.
 *
 * @see sanjaya_core.enums.FormatHintKind
 */
export enum FormatHintKind {
  String = "string",
  Number = "number",
  Integer = "integer",
  Boolean = "boolean",
  Date = "date",
  Datetime = "datetime",
  Currency = "currency",
  Percentage = "percentage",
  BasisPoints = "basis_points",
}

/**
 * Currency magnitude abbreviations.
 */
export enum CurrencyMagnitude {
  None = "",
  K = "K",
  M = "M",
  B = "B",
  T = "T",
}

// ---------------------------------------------------------------------------
// Column metadata sub-models
// ---------------------------------------------------------------------------

/**
 * Currency-specific display options for a column.
 */
export interface CurrencyOptions {
  defaultUnit?: string;
  supportedUnits?: string[];
  defaultMagnitude?: CurrencyMagnitude;
  supportedMagnitudes?: CurrencyMagnitude[];
}

/**
 * Structured formatting hints for cell rendering.
 */
export interface FormatHints {
  kind: FormatHintKind;
  decimals?: number;
  currencyCode?: string;
  currencyCodeColumn?: string;
}

/**
 * An allowed aggregate for a column used as a pivot measure.
 */
export interface PivotAggOption {
  agg: AggFunc;
  label: string;
}

/**
 * Pivot configuration hints for a dataset column.
 */
export interface PivotOptions {
  role?: "dimension" | "measure";
  allowedAggs?: PivotAggOption[];
}

// ---------------------------------------------------------------------------
// ColumnMeta
// ---------------------------------------------------------------------------

/**
 * Full metadata for a single dataset column.
 *
 * Returned by `SanjayaDataClient.getColumns()` and used throughout the
 * report-builder UI (filter widgets, pivot drag zones, cell formatters, etc.).
 *
 * @see sanjaya_core.types.ColumnMeta
 */
export interface ColumnMeta {
  name: string;
  label: string;
  type: ColumnType;
  format?: string;
  enumValues?: string[];
  operators: FilterOperator[];
  nullable: boolean;
  currency?: CurrencyOptions;
  pivot?: PivotOptions;
  formatHints?: FormatHints;
  filterStyle?: FilterStyle;
}

// Re-export filter enums used by ColumnMeta for convenience
import type { FilterOperator, FilterStyle } from "./filters.js";
import type { AggFunc } from "./ssrm.js";
export type { FilterOperator, FilterStyle, AggFunc };

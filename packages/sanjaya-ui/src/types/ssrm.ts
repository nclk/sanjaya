// ---------------------------------------------------------------------------
// AG Grid SSRM types — mirror sanjaya_django.schemas.ssrm / pivot / export
// ---------------------------------------------------------------------------

import type { ColumnType } from "./columns.js";

// ---------------------------------------------------------------------------
// Aggregate function enum
// ---------------------------------------------------------------------------

/**
 * Aggregate functions for pivot measures.
 *
 * Values align with AG Grid `aggFunc` strings.
 */
export enum AggFunc {
  Sum = "sum",
  Avg = "avg",
  Min = "min",
  Max = "max",
  Count = "count",
  DistinctCount = "distinctCount",
  First = "first",
  Last = "last",
}

// ---------------------------------------------------------------------------
// Shared column / sort descriptors
// ---------------------------------------------------------------------------

/**
 * AG Grid column descriptor sent in SSRM requests.
 *
 * Used for `rowGroupCols`, `pivotCols`, and `valueCols`.
 */
export interface ColumnVO {
  id: string;
  displayName: string;
  field?: string;
  aggFunc?: AggFunc;
}

/**
 * AG Grid sort model item.
 */
export interface SortModelItem {
  colId: string;
  sort: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * Fields common to both table and pivot SSRM requests.
 */
export interface SSRMBaseRequest {
  startRow: number;
  endRow: number;
  rowGroupCols: ColumnVO[];
  groupKeys: string[];
  valueCols: ColumnVO[];
  sortModel?: SortModelItem[];
  /** Rich FilterGroup JSON (takes precedence over filterModel). */
  filter?: Record<string, unknown>;
  /** AG Grid column-keyed filter model (legacy / fallback). */
  filterModel?: Record<string, unknown>;
}

/**
 * SSRM request for the table endpoint (flat / grouped, no pivot).
 */
export interface TableSSRMRequest extends SSRMBaseRequest {
  // No additional fields — table never pivots.
}

/**
 * SSRM request for the pivot endpoint.
 */
export interface PivotSSRMRequest extends SSRMBaseRequest {
  pivotCols: ColumnVO[];
  pivotMode: boolean;
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

/**
 * Pivot result column definition for programmatic header control.
 */
export interface PivotResultColDef {
  colId: string;
  headerName: string;
  field: string;
  type?: ColumnType;
  children?: PivotResultColDef[];
  pivotMeta?: {
    pivotKeys?: string[];
    measure?: string;
    agg?: string;
  };
}

/**
 * SSRM response (shared by table and pivot endpoints).
 */
export interface SSRMResponse {
  rowData: Record<string, unknown>[];
  rowCount?: number;
  pivotResultFields?: string[];
  secondaryColDefs?: PivotResultColDef[];
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Supported export output formats.
 */
export enum ExportFormat {
  Csv = "csv",
  Xlsx = "xlsx",
}

export interface FlatExportRequest {
  selectedColumns: string[];
  filter?: Record<string, unknown>;
  format: ExportFormat;
}

export interface GroupedExportRequest {
  rowGroupCols: ColumnVO[];
  valueCols: ColumnVO[];
  filterModel?: Record<string, unknown>;
  sortModel?: SortModelItem[];
  format: ExportFormat;
}

export interface PivotExportRequest {
  rowGroupCols: ColumnVO[];
  valueCols: ColumnVO[];
  pivotCols: ColumnVO[];
  filterModel?: Record<string, unknown>;
  sortModel?: SortModelItem[];
  format: ExportFormat;
}

/**
 * Export request — exactly one of `flat`, `grouped`, or `pivot` must be set.
 */
export interface ExportRequest {
  flat?: FlatExportRequest;
  grouped?: GroupedExportRequest;
  pivot?: PivotExportRequest;
}

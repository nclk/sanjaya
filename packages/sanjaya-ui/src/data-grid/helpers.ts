// ---------------------------------------------------------------------------
// Data-grid pure helpers — definition → AG Grid config translation
//
// These functions are framework-free and fully unit-testable.
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "../types/columns";
import { ColumnType, FormatHintKind } from "../types/columns";
import type {
  ColumnVO,
  SortModelItem,
  TableSSRMRequest,
  PivotSSRMRequest,
  PivotResultColDef,
} from "../types/ssrm";
import type { DynamicReportDefinition } from "../types/reports";
import type { FilterGroup } from "../types/filters";

// ---------------------------------------------------------------------------
// AG Grid type stand-ins
//
// We define the minimal shapes we need rather than importing the full AG
// Grid typings. This keeps the helpers testable without ag-grid installed.
// ---------------------------------------------------------------------------

/** Minimal AG Grid ColDef shape used by our helpers. */
export interface GridColDef {
  colId?: string;
  field?: string;
  headerName?: string;
  hide?: boolean;
  type?: string;
  valueFormatter?: string;
  /** Nested group children (for pivot secondary cols). */
  children?: GridColDef[];
  /** AG Grid pivot metadata. */
  pivotKeys?: string[];
  aggFunc?: string;
}

/** Minimal IServerSideGetRowsParams shape. */
export interface SSRMGetRowsParams {
  request: {
    startRow: number;
    endRow: number;
    rowGroupCols: ColumnVO[];
    groupKeys: string[];
    valueCols: ColumnVO[];
    pivotCols?: ColumnVO[];
    pivotMode?: boolean;
    sortModel: SortModelItem[];
    filterModel?: Record<string, unknown>;
  };
  success: (params: { rowData: Record<string, unknown>[]; rowCount?: number }) => void;
  fail: () => void;
}

// ---------------------------------------------------------------------------
// Column metadata → AG Grid ColDef
// ---------------------------------------------------------------------------

/** Map ColumnType to AG Grid column `type`. */
function agColumnType(ct: ColumnType): string | undefined {
  switch (ct) {
    case ColumnType.Number:
    case ColumnType.Currency:
    case ColumnType.Percentage:
      return "numericColumn";
    case ColumnType.Date:
    case ColumnType.Datetime:
      return "dateColumn";
    default:
      return undefined;
  }
}

/** Build an AG Grid `valueFormatter` expression from FormatHints. */
function formatExpression(col: ColumnMeta): string | undefined {
  const hints = col.formatHints;
  if (!hints) return undefined;

  switch (hints.kind) {
    case FormatHintKind.Currency: {
      const code = hints.currencyCode ?? "USD";
      const decimals = hints.decimals ?? 2;
      return `value != null ? new Intl.NumberFormat(undefined, { style: 'currency', currency: '${code}', minimumFractionDigits: ${decimals}, maximumFractionDigits: ${decimals} }).format(value) : ''`;
    }
    case FormatHintKind.Percentage: {
      const decimals = hints.decimals ?? 2;
      return `value != null ? (value * 100).toFixed(${decimals}) + '%' : ''`;
    }
    case FormatHintKind.Number: {
      const decimals = hints.decimals ?? 0;
      return `value != null ? new Intl.NumberFormat(undefined, { minimumFractionDigits: ${decimals}, maximumFractionDigits: ${decimals} }).format(value) : ''`;
    }
    case FormatHintKind.Integer:
      return `value != null ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value) : ''`;
    case FormatHintKind.Date:
      return `value != null ? new Date(value).toLocaleDateString() : ''`;
    case FormatHintKind.Datetime:
      return `value != null ? new Date(value).toLocaleString() : ''`;
    default:
      return undefined;
  }
}

/**
 * Convert a `ColumnMeta` to an AG Grid `ColDef`.
 *
 * The resulting object contains only primitive/serialisable values so it
 * can be safely used with any AG Grid initialisation method.
 */
export function columnMetaToColDef(col: ColumnMeta): GridColDef {
  const def: GridColDef = {
    colId: col.name,
    field: col.name,
    headerName: col.label,
  };

  const agType = agColumnType(col.type);
  if (agType) def.type = agType;

  const fmt = formatExpression(col);
  if (fmt) def.valueFormatter = fmt;

  return def;
}

/**
 * Build AG Grid `colDefs` for the table tab from a definition and
 * available column metadata.
 *
 * Only columns listed in `definition.selectedColumns` are included,
 * in the order specified.
 */
export function tableColDefs(
  definition: DynamicReportDefinition,
  columnsMeta: ColumnMeta[],
): GridColDef[] {
  // When no columns are explicitly selected, show all available columns
  if (definition.selectedColumns.length === 0) {
    return columnsMeta.map(columnMetaToColDef);
  }

  const lookup = new Map(columnsMeta.map((c) => [c.name, c]));
  return definition.selectedColumns
    .map((name) => {
      const meta = lookup.get(name);
      return meta ? columnMetaToColDef(meta) : { colId: name, field: name, headerName: name };
    });
}

// ---------------------------------------------------------------------------
// Pivot secondary column translation
// ---------------------------------------------------------------------------

/**
 * Convert server `PivotResultColDef[]` (from SSRMResponse) to AG Grid
 * `ColDef[]` for setting as secondary columns in pivot mode.
 */
export function pivotSecondaryColDefs(
  serverCols: PivotResultColDef[],
): GridColDef[] {
  return serverCols.map((sc) => {
    const def: GridColDef = {
      colId: sc.colId,
      headerName: sc.headerName,
      field: sc.field,
    };
    if (sc.pivotMeta?.pivotKeys) def.pivotKeys = sc.pivotMeta.pivotKeys;
    if (sc.pivotMeta?.agg) def.aggFunc = sc.pivotMeta.agg;
    if (sc.children && sc.children.length > 0) {
      def.children = pivotSecondaryColDefs(sc.children);
    }
    return def;
  });
}

// ---------------------------------------------------------------------------
// SSRM request builders
// ---------------------------------------------------------------------------

/**
 * Build a `TableSSRMRequest` from the definition and AG Grid SSRM params.
 */
export function buildTableRequest(
  params: SSRMGetRowsParams,
  definition: DynamicReportDefinition,
): TableSSRMRequest {
  const req = params.request;
  const result: TableSSRMRequest = {
    startRow: req.startRow,
    endRow: req.endRow,
    rowGroupCols: definition.rowGroupCols ?? req.rowGroupCols ?? [],
    groupKeys: req.groupKeys ?? [],
    valueCols: definition.valueCols ?? req.valueCols ?? [],
    sortModel: req.sortModel,
  };

  if (hasFilter(definition.filter)) {
    result.filter = definition.filter as unknown as Record<string, unknown>;
  }

  return result;
}

/**
 * Build a `PivotSSRMRequest` from the definition and AG Grid SSRM params.
 */
export function buildPivotRequest(
  params: SSRMGetRowsParams,
  definition: DynamicReportDefinition,
): PivotSSRMRequest {
  const req = params.request;
  const result: PivotSSRMRequest = {
    startRow: req.startRow,
    endRow: req.endRow,
    rowGroupCols: definition.rowGroupCols ?? req.rowGroupCols ?? [],
    groupKeys: req.groupKeys ?? [],
    valueCols: definition.valueCols ?? req.valueCols ?? [],
    pivotCols: definition.pivotCols ?? req.pivotCols ?? [],
    pivotMode: true,
    sortModel: req.sortModel,
  };

  if (hasFilter(definition.filter)) {
    result.filter = definition.filter as unknown as Record<string, unknown>;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Filter utilities
// ---------------------------------------------------------------------------

/** Check if a FilterGroup has any actual conditions. */
export function hasFilter(fg: FilterGroup | undefined | null): boolean {
  if (!fg) return false;
  const hasConds = (fg.conditions?.length ?? 0) > 0;
  const hasGroups = (fg.groups?.length ?? 0) > 0;
  return hasConds || hasGroups;
}

// ---------------------------------------------------------------------------
// Pivot readiness check
// ---------------------------------------------------------------------------

/**
 * Determine whether the definition has enough pivot configuration to
 * make a meaningful pivot request.
 *
 * A valid pivot needs at least one row group column and one value column.
 */
export function isPivotReady(def: DynamicReportDefinition | null): boolean {
  if (!def) return false;
  const hasRowGroups = (def.rowGroupCols?.length ?? 0) > 0;
  const hasValues = (def.valueCols?.length ?? 0) > 0;
  return hasRowGroups && hasValues;
}

// ---------------------------------------------------------------------------
// Report-builder shared types and pure helper functions
// ---------------------------------------------------------------------------

import type { ColumnSelection } from "../column-selector/column-selector";
import type { FilterGroup } from "../types/filters";
import { emptyFilterGroup } from "../types/filters";
import type { PivotConfig } from "../pivot-config/helpers";
import { emptyPivotConfig } from "../pivot-config/helpers";
import type {
  DynamicReport,
  DynamicReportDefinition,
  DynamicReportAction,
} from "../types/reports";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

/**
 * Complete applied state of the report builder.
 *
 * Each child component owns its own `DirtyTracker` for panel-level dirty
 * state. The orchestrator tracks the **applied** values from all children
 * and compares against `savedSnapshot` for report-level dirty state.
 */
export interface ReportBuilderState {
  datasetKey: string | null;
  columns: ColumnSelection;
  filter: FilterGroup;
  pivotConfig: PivotConfig;
}

/** Create an empty builder state. */
export function emptyBuilderState(): ReportBuilderState {
  return {
    datasetKey: null,
    columns: { columns: [] },
    filter: emptyFilterGroup(),
    pivotConfig: emptyPivotConfig(),
  };
}

// ---------------------------------------------------------------------------
// Report definition ↔ builder state conversion
// ---------------------------------------------------------------------------

/**
 * Build a `DynamicReportDefinition` from the current builder state.
 *
 * This is the payload persisted inside a saved report's metadata.
 */
export function stateToDefinition(
  state: ReportBuilderState,
): DynamicReportDefinition | null {
  if (!state.datasetKey) return null;

  const selectedColumns = state.columns.columns
    .filter((c) => c.selected)
    .sort((a, b) => a.order - b.order)
    .map((c) => c.name);

  return {
    datasetKey: state.datasetKey,
    selectedColumns,
    filter: state.filter,
    rowGroupCols:
      state.pivotConfig.rowGroupCols.length > 0
        ? state.pivotConfig.rowGroupCols
        : undefined,
    pivotCols:
      state.pivotConfig.pivotCols.length > 0
        ? state.pivotConfig.pivotCols
        : undefined,
    valueCols:
      state.pivotConfig.valueCols.length > 0
        ? state.pivotConfig.valueCols
        : undefined,
  };
}

/**
 * Hydrate builder state from a saved report's definition.
 *
 * Partial — only sets fields present in the definition. Columns are
 * rebuilt as a `ColumnSelection` from the selected column name list.
 */
export function definitionToState(
  def: DynamicReportDefinition,
): ReportBuilderState {
  const columns: ColumnSelection = {
    columns: def.selectedColumns.map((name, i) => ({
      name,
      selected: true,
      isGroup: false,
      order: i,
    })),
  };

  return {
    datasetKey: def.datasetKey,
    columns,
    filter: def.filter ?? emptyFilterGroup(),
    pivotConfig: {
      rowGroupCols: def.rowGroupCols ?? [],
      pivotCols: def.pivotCols ?? [],
      valueCols: def.valueCols ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Action menu helpers
// ---------------------------------------------------------------------------

/**
 * Actions that are always available on the client side, independent of
 * the server's `availableActions` list.
 */
export type ClientAction =
  | "save"
  | "saveAs"
  | "reset"
  | "clearAll"
  | "export";

/** Union of server lifecycle actions and client-only actions. */
export type MenuAction = DynamicReportAction | ClientAction;

/** Configuration for a single menu item. */
export interface MenuActionItem {
  action: MenuAction;
  label: string;
  /** Whether this action is currently enabled. */
  enabled: boolean;
  /** Separator line before this item. */
  separator?: boolean;
  /** Danger styling (e.g. Delete). */
  danger?: boolean;
}

/**
 * Build the full actions menu list from current state.
 *
 * @param report          The currently loaded report (null for unsaved).
 * @param reportDirty     Whether applied state ≠ saved state.
 * @param hasDataset      Whether a dataset is selected.
 * @param hasAnyState     Whether any panel has non-default applied state.
 */
export function buildActionMenu(
  report: DynamicReport | null,
  reportDirty: boolean,
  hasDataset: boolean,
  hasAnyState: boolean,
): MenuActionItem[] {
  const serverActions = new Set(report?.availableActions ?? []);
  const isSaved = report !== null;

  const items: MenuActionItem[] = [
    // --- Client-side actions ---
    {
      action: "save",
      label: "Save",
      enabled: reportDirty && hasDataset,
    },
    {
      action: "saveAs",
      label: isSaved ? "Save As…" : "Save As New…",
      enabled: hasDataset,
    },
    {
      action: "reset",
      label: "Reset",
      enabled: reportDirty,
    },
    {
      action: "clearAll",
      label: "Clear All",
      enabled: hasAnyState,
    },
    {
      action: "export",
      label: "Export As…",
      enabled: hasDataset,
      separator: true,
    },
  ];

  // --- Server lifecycle actions (only when a saved report exists) ---
  if (isSaved) {
    const lifecycle: Array<{
      action: DynamicReportAction;
      label: string;
      separator?: boolean;
      danger?: boolean;
    }> = [
      { action: "publish" as DynamicReportAction, label: "Publish", separator: true },
      { action: "unpublish" as DynamicReportAction, label: "Unpublish" },
      { action: "archive" as DynamicReportAction, label: "Archive" },
      { action: "restore" as DynamicReportAction, label: "Restore" },
      { action: "share" as DynamicReportAction, label: "Share…", separator: true },
      {
        action: "transferOwnership" as DynamicReportAction,
        label: "Transfer Ownership…",
      },
      { action: "favorite" as DynamicReportAction, label: "Favorite" },
      {
        action: "delete" as DynamicReportAction,
        label: "Delete",
        separator: true,
        danger: true,
      },
    ];

    for (const item of lifecycle) {
      if (serverActions.has(item.action)) {
        items.push({
          action: item.action,
          label: item.label,
          enabled: true,
          separator: item.separator,
          danger: item.danger,
        });
      }
    }
  }

  return items;
}

/**
 * Check whether the current builder state has any non-default applied
 * values (i.e. user has configured something).
 */
export function hasNonDefaultState(state: ReportBuilderState): boolean {
  if (state.datasetKey !== null) return true;
  if (state.columns.columns.length > 0) return true;
  if (
    (state.filter.conditions?.length ?? 0) > 0 ||
    (state.filter.groups?.length ?? 0) > 0
  ) {
    return true;
  }
  if (
    state.pivotConfig.rowGroupCols.length > 0 ||
    state.pivotConfig.pivotCols.length > 0 ||
    state.pivotConfig.valueCols.length > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Deep-compare two builder states to detect report-level dirty state.
 */
export function isReportDirty(
  current: ReportBuilderState,
  saved: ReportBuilderState | null,
): boolean {
  if (saved === null) {
    // Never saved — dirty if anything is configured
    return hasNonDefaultState(current);
  }
  return JSON.stringify(current) !== JSON.stringify(saved);
}

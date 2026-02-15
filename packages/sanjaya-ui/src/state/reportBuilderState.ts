/**
 * Report builder state — shared across all child components.
 *
 * Managed via `useReducer` in the ReportBuilder orchestrator and passed
 * down through props (no external state library).
 */

import type {
  ColumnVO,
  FilterGroup,
  SortModelItem,
  Column,
  Dataset,
} from "../api/types";

// ─── State shape ─────────────────────────────────────────────────────

export type ActiveTab = "table" | "pivot";

export interface ReportBuilderState {
  /** Currently selected dataset */
  datasetKey: string | null;
  /** Column metadata fetched for the active dataset */
  columns: Column[];
  /** Available datasets */
  datasets: Dataset[];

  /** Columns selected for display / export */
  selectedColumns: string[];
  /** Active filter tree */
  filterGroup: FilterGroup;
  /** Row group columns (table grouped mode + pivot) */
  rowGroupCols: ColumnVO[];
  /** Pivot columns (pivot mode only) */
  pivotCols: ColumnVO[];
  /** Value / measure columns with aggFunc */
  valueCols: ColumnVO[];
  /** Sort model */
  sortModel: SortModelItem[];

  /** Which tab is active */
  activeTab: ActiveTab;

  /** Loading states */
  loading: {
    datasets: boolean;
    columns: boolean;
  };

  /** Error messages */
  error: string | null;

  /** Dirty tracking — snapshot of the last saved state */
  lastSavedSnapshot: SavedSnapshot | null;
}

export interface SavedSnapshot {
  datasetKey: string | null;
  selectedColumns: string[];
  filterGroup: FilterGroup;
  rowGroupCols: ColumnVO[];
  pivotCols: ColumnVO[];
  valueCols: ColumnVO[];
  sortModel: SortModelItem[];
}

// ─── Actions ─────────────────────────────────────────────────────────

export type ReportBuilderAction =
  | { type: "SET_DATASETS"; datasets: Dataset[] }
  | { type: "SET_DATASET_KEY"; datasetKey: string | null }
  | { type: "SET_COLUMNS"; columns: Column[] }
  | { type: "SET_SELECTED_COLUMNS"; selectedColumns: string[] }
  | { type: "SET_FILTER_GROUP"; filterGroup: FilterGroup }
  | { type: "SET_ROW_GROUP_COLS"; rowGroupCols: ColumnVO[] }
  | { type: "SET_PIVOT_COLS"; pivotCols: ColumnVO[] }
  | { type: "SET_VALUE_COLS"; valueCols: ColumnVO[] }
  | { type: "SET_SORT_MODEL"; sortModel: SortModelItem[] }
  | { type: "SET_ACTIVE_TAB"; activeTab: ActiveTab }
  | { type: "SET_LOADING"; key: keyof ReportBuilderState["loading"]; value: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "MARK_SAVED" }
  | { type: "LOAD_DEFINITION"; snapshot: SavedSnapshot };

// ─── Initial state ───────────────────────────────────────────────────

export const emptyFilterGroup: FilterGroup = {
  combinator: "and",
  conditions: [],
};

export const initialState: ReportBuilderState = {
  datasetKey: null,
  columns: [],
  datasets: [],
  selectedColumns: [],
  filterGroup: emptyFilterGroup,
  rowGroupCols: [],
  pivotCols: [],
  valueCols: [],
  sortModel: [],
  activeTab: "table",
  loading: { datasets: false, columns: false },
  error: null,
  lastSavedSnapshot: null,
};

// ─── Reducer ─────────────────────────────────────────────────────────

export function reportBuilderReducer(
  state: ReportBuilderState,
  action: ReportBuilderAction,
): ReportBuilderState {
  switch (action.type) {
    case "SET_DATASETS":
      return { ...state, datasets: action.datasets };

    case "SET_DATASET_KEY":
      return {
        ...state,
        datasetKey: action.datasetKey,
        // Reset dependent state when dataset changes
        columns: [],
        selectedColumns: [],
        filterGroup: emptyFilterGroup,
        rowGroupCols: [],
        pivotCols: [],
        valueCols: [],
        sortModel: [],
        error: null,
      };

    case "SET_COLUMNS":
      return { ...state, columns: action.columns };

    case "SET_SELECTED_COLUMNS":
      return { ...state, selectedColumns: action.selectedColumns };

    case "SET_FILTER_GROUP":
      return { ...state, filterGroup: action.filterGroup };

    case "SET_ROW_GROUP_COLS":
      return { ...state, rowGroupCols: action.rowGroupCols };

    case "SET_PIVOT_COLS":
      return { ...state, pivotCols: action.pivotCols };

    case "SET_VALUE_COLS":
      return { ...state, valueCols: action.valueCols };

    case "SET_SORT_MODEL":
      return { ...state, sortModel: action.sortModel };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.activeTab };

    case "SET_LOADING":
      return {
        ...state,
        loading: { ...state.loading, [action.key]: action.value },
      };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "MARK_SAVED":
      return {
        ...state,
        lastSavedSnapshot: extractSnapshot(state),
      };

    case "LOAD_DEFINITION":
      return {
        ...state,
        datasetKey: action.snapshot.datasetKey,
        selectedColumns: action.snapshot.selectedColumns,
        filterGroup: action.snapshot.filterGroup,
        rowGroupCols: action.snapshot.rowGroupCols,
        pivotCols: action.snapshot.pivotCols,
        valueCols: action.snapshot.valueCols,
        sortModel: action.snapshot.sortModel,
        lastSavedSnapshot: action.snapshot,
      };

    default:
      return state;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function extractSnapshot(state: ReportBuilderState): SavedSnapshot {
  return {
    datasetKey: state.datasetKey,
    selectedColumns: state.selectedColumns,
    filterGroup: state.filterGroup,
    rowGroupCols: state.rowGroupCols,
    pivotCols: state.pivotCols,
    valueCols: state.valueCols,
    sortModel: state.sortModel,
  };
}

export function isDirty(state: ReportBuilderState): boolean {
  if (!state.lastSavedSnapshot) {
    // Never saved — dirty if any meaningful state exists
    return state.datasetKey !== null;
  }
  const current = extractSnapshot(state);
  return JSON.stringify(current) !== JSON.stringify(state.lastSavedSnapshot);
}

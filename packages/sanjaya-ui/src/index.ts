// ---------------------------------------------------------------------------
// @pojagi/sanjaya-ui — public entry point
// ---------------------------------------------------------------------------

// All types (enums, interfaces, helper functions)
export * from "./types/index";

// Shared utilities
export { DirtyTracker } from "./shared/state";
export { emit, callbackName } from "./shared/events";

// Components (side-effect: registers custom elements)
export { SanjayaDatasetPicker } from "./dataset-picker/dataset-picker";
export type { DatasetChangeDetail } from "./dataset-picker/dataset-picker";

export { SanjayaColumnSelector } from "./column-selector/column-selector";
export type {
  ColumnEntry,
  ColumnSelection,
  ColumnsChangeDetail,
} from "./column-selector/column-selector";

export { SanjayaFilterBuilder } from "./filter-builder/filter-builder";
export type {
  FilterChangeDetail,
  FilterMode,
} from "./filter-builder/filter-builder";

export { SanjayaFilterBasic } from "./filter-builder/basic/basic-mode";
export { SanjayaFilterAdvanced } from "./filter-builder/advanced/advanced-mode";

// Filter-builder helpers (useful for consumers building custom UIs)
export {
  OPERATOR_LABELS,
  NULL_OPERATORS,
  emptyBasicRow,
  basicRowsToFilterGroup,
  filterGroupToBasicRows,
  isBasicCompatible,
  inputTypeForColumn,
} from "./filter-builder/helpers";
export type { BasicRow } from "./filter-builder/helpers";

// Pivot config
export { SanjayaPivotConfig } from "./pivot-config/pivot-config";
export type { PivotConfigChangeDetail } from "./pivot-config/pivot-config";

export { SanjayaPivotZone } from "./pivot-config/zone-panel/zone-panel";
export type {
  ZoneAddDetail,
  ZoneRemoveDetail,
  ZoneReorderDetail,
  ZoneAggChangeDetail,
} from "./pivot-config/zone-panel/zone-panel";

// Pivot helpers
export {
  AGG_LABELS,
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
} from "./pivot-config/helpers";
export type { PivotConfig, PivotZone } from "./pivot-config/helpers";

// Report builder orchestrator
export { SanjayaReportBuilder } from "./report-builder/report-builder";
export type {
  ReportDefinitionChangeDetail,
  ReportActionDetail,
} from "./report-builder/report-builder";

export { SanjayaActionsMenu } from "./report-builder/actions-menu/actions-menu";
export type { ActionSelectDetail } from "./report-builder/actions-menu/actions-menu";

// Report-builder helpers
export {
  emptyBuilderState,
  stateToDefinition,
  definitionToState,
  buildActionMenu,
  hasNonDefaultState,
  isReportDirty,
} from "./report-builder/helpers";
export type {
  ReportBuilderState,
  ClientAction,
  MenuAction,
  MenuActionItem,
} from "./report-builder/helpers";

// Data grid (AG Grid SSRM viewer)
export { SanjayaDataGrid } from "./data-grid/data-grid";
export type {
  DataGridTab,
  TabChangeDetail,
  GridReadyDetail,
} from "./data-grid/data-grid";

// Data-grid helpers (useful for consumers building custom grid setups)
export {
  columnMetaToColDef,
  tableColDefs,
  pivotSecondaryColDefs,
  buildTableRequest,
  buildPivotRequest,
  hasFilter,
  isPivotReady,
} from "./data-grid/helpers";
export type {
  GridColDef,
  SSRMGetRowsParams,
} from "./data-grid/helpers";

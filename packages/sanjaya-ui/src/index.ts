// ---------------------------------------------------------------------------
// @pojagi/sanjaya-ui — public entry point
// ---------------------------------------------------------------------------

// All types (enums, interfaces, helper functions)
export * from "./types/index.js";

// Shared utilities
export { DirtyTracker } from "./shared/state.js";
export { emit, callbackName } from "./shared/events.js";

// Components (side-effect: registers custom elements)
export { SanjayaDatasetPicker } from "./dataset-picker/dataset-picker.js";
export type { DatasetChangeDetail } from "./dataset-picker/dataset-picker.js";

export { SanjayaColumnSelector } from "./column-selector/column-selector.js";
export type {
  ColumnEntry,
  ColumnSelection,
  ColumnsChangeDetail,
} from "./column-selector/column-selector.js";

export { SanjayaFilterBuilder } from "./filter-builder/filter-builder.js";
export type {
  FilterChangeDetail,
  FilterMode,
} from "./filter-builder/filter-builder.js";

export { SanjayaFilterBasic } from "./filter-builder/basic/basic-mode.js";
export { SanjayaFilterAdvanced } from "./filter-builder/advanced/advanced-mode.js";

// Filter-builder helpers (useful for consumers building custom UIs)
export {
  OPERATOR_LABELS,
  NULL_OPERATORS,
  emptyBasicRow,
  basicRowsToFilterGroup,
  filterGroupToBasicRows,
  isBasicCompatible,
  inputTypeForColumn,
} from "./filter-builder/helpers.js";
export type { BasicRow } from "./filter-builder/helpers.js";

// Pivot config
export { SanjayaPivotConfig } from "./pivot-config/pivot-config.js";
export type { PivotConfigChangeDetail } from "./pivot-config/pivot-config.js";

export { SanjayaPivotZone } from "./pivot-config/zone-panel/zone-panel.js";
export type {
  ZoneAddDetail,
  ZoneRemoveDetail,
  ZoneReorderDetail,
  ZoneAggChangeDetail,
} from "./pivot-config/zone-panel/zone-panel.js";

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
} from "./pivot-config/helpers.js";
export type { PivotConfig, PivotZone } from "./pivot-config/helpers.js";

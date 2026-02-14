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

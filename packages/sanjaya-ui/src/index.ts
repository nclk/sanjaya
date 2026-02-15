/**
 * @pojagi/sanjaya-ui — React + MUI + AG Grid report builder components.
 *
 * This is the package entry point. It re-exports all public components,
 * the SanjayaClient interface, the context provider, and shared types.
 */

// Provider
export { SanjayaProvider, useSanjayaClient } from "./providers/SanjayaProvider";
export type { SanjayaProviderProps } from "./providers/SanjayaProvider";

// Client interface
export type { SanjayaClient } from "./api/client";

// Components
export {
  DatasetPicker,
  ColumnSelector,
  FilterBuilder,
  PivotConfigurator,
  DataGrid,
  ReportBuilder,
} from "./components";
export type {
  DatasetPickerProps,
  ColumnSelectorProps,
  FilterBuilderProps,
  PivotConfiguratorProps,
  DataGridProps,
  ReportBuilderProps,
} from "./components";

// State (for advanced usage / custom orchestrators)
export {
  reportBuilderReducer,
  initialState,
  isDirty,
  extractSnapshot,
  emptyFilterGroup,
} from "./state/reportBuilderState";
export type {
  ReportBuilderState,
  ReportBuilderAction,
  SavedSnapshot,
  ActiveTab,
} from "./state/reportBuilderState";

// API types (re-exported for convenience)
export type * from "./api/types";

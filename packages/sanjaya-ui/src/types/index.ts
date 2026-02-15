// ---------------------------------------------------------------------------
// Types barrel — re-exports everything for public consumption
// ---------------------------------------------------------------------------

// Columns & metadata
export {
  ColumnType,
  FormatHintKind,
  CurrencyMagnitude,
  type CurrencyOptions,
  type FormatHints,
  type PivotAggOption,
  type PivotOptions,
  type ColumnMeta,
} from "./columns";

// Filters
export {
  FilterOperator,
  FilterCombinator,
  FilterStyle,
  type FilterCondition,
  type FilterGroup,
  emptyFilterGroup,
} from "./filters";

// Datasets
export {
  type DatasetCapabilities,
  type DatasetSummary,
} from "./datasets";

// SSRM / AG Grid
export {
  AggFunc,
  ExportFormat,
  type ColumnVO,
  type SortModelItem,
  type SSRMBaseRequest,
  type TableSSRMRequest,
  type PivotSSRMRequest,
  type PivotResultColDef,
  type SSRMResponse,
  type FlatExportRequest,
  type GroupedExportRequest,
  type PivotExportRequest,
  type ExportRequest,
} from "./ssrm";

// Reports
export {
  DynamicReportStatus,
  DynamicReportAction,
  type SharePermission,
  type DynamicReportDefinition,
  type DynamicReportMetadata,
  type UserReference,
  type DynamicReport,
  type DynamicReportSummary,
  type ReportListParams,
  type ReportListResponse,
  type CreateReportRequest,
  type UpdateReportRequest,
  type UserShareOut,
  type GroupShareOut,
  type ShareListResponse,
  type UserShareRequest,
  type GroupShareRequest,
} from "./reports";

// Client interface
export { type SanjayaDataClient } from "./client";

import "./errors.tsp";

namespace Models;

@doc("Column data types supported by the reporting system")
enum ColumnType {
  string,
  number,
  currency,
  percentage,
  date,
  datetime,
  boolean,
}

@doc("Currency magnitude for display formatting")
enum CurrencyMagnitude {
  none: "",
  thousands: "K",
  millions: "M",
  billions: "B",
  trillions: "T",
}

@doc("Filter operators available for conditions")
enum FilterOperator {
  eq,
  neq,
  gt,
  lt,
  gte,
  lte,
  contains,
  startswith,
  endswith,
  isNull,
  isNotNull,
  between,
  in,
}

@doc("Logical combinator for filter groups")
enum FilterCombinator {
  and,
  or,
}

@doc("UI style for filtering a column")
enum FilterStyle {
  @doc("standard operator-based filtering (default)")
  operators,

  @doc("Multi-select list for selecting multiple values (uses 'in' operator)")
  select,
}

@doc("Export format options")
enum ExportFormat {
  csv,
  xlsx,
}

@doc("Aggregate functions for pivot measures (aligns with AG Grid aggFunc values)")
enum AggFunc {
  sum,
  avg,
  min,
  max,
  count,
  distinctCount,
  first,
  last,
}

@doc("Normalized report builder payload stored in saved report metadata")
model DynamicReportDefinition {
  @doc("Dataset key used when building/running the report")
  datasetKey: string;

  @doc("selected output columns")
  selectedColumns: string[];

  @doc("Filter group authored by the report builder")
  filter: FilterGroup;

  @doc("Row-group columns (used in both table grouped mode and pivot)")
  rowGroupCols?: ColumnVO[];

  @doc("Pivot cross-tab columns (pivot mode only)")
  pivotCols?: ColumnVO[];

  @doc("Value/measure columns with aggregate functions")
  valueCols?: ColumnVO[];

  @doc("Sort model to restore column sort state")
  sortModel?: SortModelItem[];
}

@doc("well-known metadata keys for a saved dynamic report")
model DynamicReportMetadata {
  @doc("Stable dataset identifier to support quick-filters and icon mapping")
  datasetKey?: string;

  @doc("Owner of the saved report (e.g., user id or display name depending on backend implementation)")
  owner?: string;

  @doc("Normalized definition created by the report builder")
  definition?: DynamicReportDefinition;
}

@doc("status for a saved dynamic report")
enum DynamicReportStatus {
  draft,
  published,
  archived,
}

@doc("Lifecycle actions available for a saved dynamic report")
enum DynamicReportAction {
  edit,
  publish,
  unpublish,
  archive,
  restore,
  share,
  favorite,
  transferOwnership,
  delete,
}

@doc("Permission level granted to a user or group for a report")
enum DynamicReportPermission {
  viewer,
  editor,
  owner,
}

@doc("Reference to a user")
model UserReference {
  id: string;
  name: string;
  email?: string;
}

@doc("A saved dynamic report")
model DynamicReport {
  id: string;
  title: string;
  description?: string;
  status: DynamicReportStatus;
  createdBy: UserReference;
  createdAt: utcDateTime;
  updatedBy?: UserReference;
  updatedAt?: utcDateTime;
  publishedAt?: utcDateTime;
  publishedBy?: UserReference;
  archivedAt?: utcDateTime;
  version: int32;
  tags?: string[];

  @doc("Server-computed list of available actions")
  availableActions: DynamicReportAction[];

  @doc("Arbitrary backend-defined metadata")
  metadata?: DynamicReportMetadata;

  @doc("Whether the requesting user has favorited this report")
  isFavorited: boolean;
}

@doc("Summary shape used for list responses")
model DynamicReportSummary {
  id: string;
  title: string;
  status: DynamicReportStatus;
  createdBy: UserReference;
  updatedAt?: utcDateTime;
  version: int32;
  availableActions: DynamicReportAction[];
  metadata?: DynamicReportMetadata;

  @doc("Whether the requesting user has favorited this report")
  isFavorited: boolean;
}

@doc("Filter options for listing saved reports")
model DynamicReportFilter {
  status?: DynamicReportStatus[];
  createdBy?: string;
  tags?: string[];
  search?: string;

  @doc("Filter to only favorited reports")
  favorited?: boolean;

  @doc("Metadata filters are backend-defined")
  metadata?: Record<string[]>;
}

@doc("Sort field options")
enum DynamicReportSortField {
  title,
  createdAt,
  updatedAt,
  status,
}

@doc("Response for list saved reports")
model ListDynamicReportsResponse {
  reports: DynamicReportSummary[];
  total: int32;
  limit: int32;
  offset: int32;
}

@doc("Create saved report")
model CreateDynamicReportRequest {
  title: string;
  description?: string;
  tags?: string[];
  metadata?: DynamicReportMetadata;
}

@doc("Update saved report")
model UpdateDynamicReportRequest {
  title?: string;
  description?: string;
  tags?: string[];
  metadata?: DynamicReportMetadata;
}

@doc("Perform lifecycle action")
model PerformDynamicReportActionRequest {
  action: DynamicReportAction;
  reason?: string;

  @doc("Target user id for transferOwnership")
  targetUserId?: string;
}

@doc("Response for lifecycle action")
model DynamicReportActionResponse {
  report: DynamicReport;
  message: string;
}

@doc("stats for saved reports")
model DynamicReportStats {
  total: int32;
  drafts: int32;
  published: int32;
  archived: int32;
  byType: Record<int32>;
}

@doc("Share entry for an individual user")
model DynamicReportUserShare {
  user: UserReference;
  permission: DynamicReportPermission;
}

@doc("Share entry for a group")
model DynamicReportGroupShare {
  groupId: string;

  @doc("Display name for UI; may be group.display_name or fallback to group.name")
  groupName: string;

  permission: DynamicReportPermission;
}

@doc("List share roster for a report")
model ListDynamicReportSharesResponse {
  users: DynamicReportUserShare[];
  groups: DynamicReportGroupShare[];
}

@doc("Create or update a user share")
model UpsertDynamicReportUserShareRequest {
  userId: string;
  permission: DynamicReportPermission;
}

@doc("Delete a user share")
model DeleteDynamicReportUserShareRequest {
  userId: string;
}

@doc("create or update a group share")
model UpsertDynamicReportGroupShareRequest {
  groupId: string;
  permission: DynamicReportPermission;
}

@doc("Delete a group share")
model DeleteDynamicReportGroupShareRequest {
  groupId: string;
}

@doc("A dataset available for reporting")
model DynamicReportingDataset {
  @doc("Unique identifier for the dataset")
  key: string;

  @doc("Human-readable name for the dataset")
  label: string;

  @doc("Description of the dataset contents")
  description: string;

  @doc("Dataset capability flags used by the report builder UI")
  capabilities: {
    @doc("whether server-side pivoting is enabled for this dataset")
    pivot: boolean;
  };
}

@doc("Response containing available datasets")
model DatasetsResponse {
  datasets: DynamicReportingDataset[];
}

@doc("Currency-specific column options")
model CurrencyOptions {
  @doc("Default currency unit (e.g., USD, EUR)")
  defaultUnit?: string;

  @doc("List of supported currency units")
  supportedUnits?: string[];

  @doc("Default magnitude for display")
  defaultMagnitude?: CurrencyMagnitude;

  @doc("Supported magnitudes for this column")
  supportedMagnitudes?: CurrencyMagnitude[];
}

@doc("Pivot-specific metadata for a dataset column")
model ColumnPivotAggOption {
  @doc("Aggregate function")
  agg: AggFunc;

  @doc("User-facing label for the aggregate (e.g. 'Sum', 'Count')")
  label: string;
}

@doc("Pivot configuration hints for a dataset column")
model ColumnPivotOptions {
  @doc("Hint for how the column is typically used")
  role?: "dimension" | "measure";

  @doc("which aggregates are allowed when using this column as a measure")
  allowedAggs?: ColumnPivotAggOption[];
}

@doc("Structured formatting hints for report outputs")
model ColumnFormatHints {
  @doc("Business-oriented format kind")
  kind:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "date"
    | "datetime"
    | "currency"
    | "percentage"
    | "basis_points";

  @doc("Decimal places to display (when applicable)")
  decimals?: int32;

  @doc("Default currency code (may be overridden by row-level currency)")
  currencyCode?: string;

  @doc("If currency is row-level, name of the dataset column containing the currency code")
  currencyCodeColumn?: string;
}

@doc("Column metadata for a dataset")
model Column {
  @doc("Column identifier used in filters")
  name: string;

  @doc("Human-readable column label")
  label: string;

  @doc("Data type of the column")
  type: ColumnType;

  @doc("Display format string")
  format?: string;

  @doc("Possible values for enum-like columns")
  enumValues?: string[];

  @doc("Available filter operators for this column")
  operators: FilterOperator[];

  @doc("whether the column can contain null values")
  nullable: boolean;

  @doc("Currency-specific options")
  currency?: CurrencyOptions;

  @doc("Pivot-related metadata used by the Pivot UI")
  pivot?: ColumnPivotOptions;

  @doc("Typed format hints for cell rendering (in addition to `type`/`currency`)")
  formatHints?: ColumnFormatHints;

  @doc("UI style for filtering this column (defaults to 'operators')")
  filterStyle?: FilterStyle;
}

@doc("Response containing column metadata")
model ColumnsResponse {
  columns: Column[];
}

@doc("A single filter condition")
model FilterCondition {
  @doc("Column name to filter on")
  column: string;

  @doc("Filter operator")
  operator: FilterOperator;

  @doc("Value(s) to compare against")
  value?: unknown;

  @doc("Negate this condition")
  not?: boolean;
}

@doc("A group of filter conditions")
model FilterGroup {
  @doc("Logical combinator for conditions in this group")
  combinator: FilterCombinator;

  @doc("Negate the entire group")
  not?: boolean;

  @doc("Filter conditions in this group")
  conditions: FilterCondition[];

  @doc("Nested filter groups")
  groups?: FilterGroup[];
}

@doc("Request body for preview endpoint")
model PreviewRequest {
  @doc("Selected columns to include in the preview result")
  selectedColumns: string[];

  @doc("Filter to apply to the dataset")
  filter?: FilterGroup;

  @doc("Maximum number of rows to return")
  limit?: int32 = 100;

  @doc("Number of rows to skip")
  offset?: int32 = 0;
}

@doc("Response from preview endpoint")
model PreviewResponse {
  @doc("Column names in the result set")
  columns: string[];

  @doc("Data rows")
  rows: Record<unknown>[];

  @doc("Total number of rows matching the filter")
  total?: int32;
}

@doc("Request body for flat (non-pivot) export")
model FlatExportRequest {
  @doc("selected columns to include in export")
  selectedColumns: string[];

  @doc("Filter to apply to the dataset")
  filter?: FilterGroup;

  @doc("Export format")
  format: ExportFormat;
}

@doc("Request body for grouped (non-pivot) export. Produces a flat aggregated table with one row per group combination. No drill-down — only the top-level summary is exported.")
model GroupedExportRequest {
  @doc("Row group columns")
  rowGroupCols: ColumnVO[];

  @doc("Value / measure columns with aggFunc")
  valueCols: ColumnVO[];

  @doc("AG Grid filter model")
  filterModel?: Record<unknown>;

  @doc("Sort model")
  sortModel?: SortModelItem[];

  @doc("Export format")
  format: ExportFormat;
}

@doc("Request body for pivot export. Uses the same AG Grid SSRM shape but the server materialises the full result (ignoring startRow/endRow) and renders a cross-tab spreadsheet.")
model PivotExportRequest {
  @doc("Row group columns (same as SSRM request)")
  rowGroupCols: ColumnVO[];

  @doc("Value / measure columns with aggFunc")
  valueCols: ColumnVO[];

  @doc("Pivot columns")
  pivotCols: ColumnVO[];

  @doc("AG Grid filter model")
  filterModel?: Record<unknown>;

  @doc("Sort model")
  sortModel?: SortModelItem[];

  @doc("Export format")
  format: ExportFormat;
}

@doc("Unified export request — send exactly one of flat, grouped, or pivot")
model ExportRequest {
  @doc("Flat export parameters (table tab, no row groups)")
  flat?: FlatExportRequest;

  @doc("Grouped export parameters (table tab with row groups + aggregation, no pivot)")
  grouped?: GroupedExportRequest;

  @doc("Pivot export parameters (pivot tab)")
  pivot?: PivotExportRequest;
}

// ──────────────────────────────────────────────────────────────────────
// AG Grid Server-Side Row Model (SSRM) — Pivot request / response
//
// The wire format mirrors AG Grid's IServerSideGetRowsRequest so the
// front end can forward the request with minimal transformation.
// The back end translates this into a grid-agnostic provider call.
// ──────────────────────────────────────────────────────────────────────

@doc("Column descriptor sent by AG Grid (rowGroupCols / pivotCols / valueCols)")
model ColumnVO {
  @doc("Column identifier")
  id: string;

  @doc("Display name shown in column header")
  displayName: string;

  @doc("Underlying data field name")
  field?: string;

  @doc("Aggregate function (for value columns)")
  aggFunc?: AggFunc;
}

@doc("Sort descriptor sent by AG Grid")
model SortModelItem {
  @doc("Column id to sort on")
  colId: string;

  @doc("Sort direction")
  sort: "asc" | "desc";
}

@doc("Shared fields for AG Grid SSRM requests (table and pivot)")
model SSRMBaseRequest {
  @doc("First row index requested (inclusive, 0-based)")
  startRow: int32;

  @doc("Last row index requested (exclusive)")
  endRow: int32;

  @doc("Columns the grid is grouping rows by")
  rowGroupCols: ColumnVO[];

  @doc("Keys of the currently expanded group path")
  groupKeys: string[];

  @doc("Columns used as value / measure columns (with aggFunc)")
  valueCols: ColumnVO[];

  @doc("Sort model")
  sortModel?: SortModelItem[];

  @doc("Rich filter tree built by custom filter widgets (sanjaya FilterGroup format). Takes precedence over filterModel when both are provided.")
  filter?: FilterGroup;

  @doc("AG Grid column-keyed filter model (legacy / fallback). Ignored when 'filter' is provided.")
  filterModel?: Record<unknown>;
}

@doc("AG Grid SSRM request for the table endpoint — flat data, row grouping, and aggregation (no pivot)")
model TableGetRowsRequest extends SSRMBaseRequest {}

@doc("AG Grid SSRM request for the pivot endpoint — requires pivotMode and at least one pivot column")
model ServerSideGetRowsRequest extends SSRMBaseRequest {
  @doc("Columns the grid is pivoting on (at least one required)")
  @minItems(1)
  pivotCols: ColumnVO[];

  @doc("Whether pivot mode is active in the grid (must be true)")
  pivotMode: boolean;
}

@doc("AG Grid SSRM success response")
model ServerSideGetRowsResponse {
  @doc("Row data for the requested range")
  rowData: Record<unknown>[];

  @doc("Total row count at this group level (null = unknown / infinite scroll)")
  rowCount?: int32;

  @doc("Dynamic pivot result field names, e.g. ['2024_sum_amount', '2025_sum_amount']. AG Grid uses serverSidePivotResultFieldSeparator (default '_') to build column groups.")
  pivotResultFields?: string[];

  @doc("Optional secondary column definitions for full control over pivot column headers. When provided, the front end should call api.setPivotResultColumns(). Mutually exclusive with pivotResultFields.")
  secondaryColDefs?: PivotResultColDef[];
}

@doc("Column definition for server-driven pivot result columns (optional, for advanced header control)")
model PivotResultColDef {
  @doc("Unique column id")
  colId: string;

  @doc("Header label")
  headerName: string;

  @doc("Data field in rowData")
  field: string;

  @doc("Optional type hint for formatting")
  type?: ColumnType;

  @doc("Nested children for grouped headers")
  children?: PivotResultColDef[];

  @doc("Pivot metadata for programmatic use")
  pivotMeta?: {
    @doc("Ordered values along the pivot axis that identify this column")
    pivotKeys: string[];

    @doc("Measure column name")
    measure: string;

    @doc("Aggregate function applied")
    agg: AggFunc;
  };
}

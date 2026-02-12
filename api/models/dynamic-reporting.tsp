import "@typespec/http";
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

@doc("Aggregate functions supported for pivot measures")
enum PivotAgg {
  sum,
  avg,
  min,
  max,
  count,
  distinctCount,
}

@doc("Normalized report builder payload stored in saved report metadata")
model DynamicReportDefinition {
  @doc("Dataset key used when building/running the report")
  datasetKey: string;

  @doc("selected output columns")
  selectedColumns: string[];

  @doc("Filter group authored by the report builder")
  filter: FilterGroup;
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
}

@doc("Filter options for listing saved reports")
model DynamicReportFilter {
  status?: DynamicReportStatus[];
  createdBy?: string;
  tags?: string[];
  search?: string;

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
  agg: PivotAgg;

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

@doc("Request body for export endpoint")
model ExportRequest {
  @doc("selected columns to include in export")
  selectedColumns: string[];

  @doc("Filter to apply to the dataset")
  filter?: FilterGroup;

  @doc("Optional pivot configuration. when provided with format=xlsx, the export may include a pivot sheet derived from the raw data.")
  pivot?: PivotRequest;

  @doc("Optional bundling behavior. When true, the server may return a container (e.g., a .zip) including multiple files.")
  bundle?: boolean;

  @doc("Export format")
  format: ExportFormat;
}

@doc("Pivot value (measure) specification")
model PivotValueSpec {
  @doc("Dataset column name for the measure")
  column: string;

  @doc("Aggregate function to apply")
  agg: PivotAgg;

  @doc("Optional label override for UI")
  label?: string;
}

@doc("Rollup/subtotal options for pivot preview/export")
model PivotRollupSpec {
  @doc("whether to include row-only rollups/subtotals (v1)")
  rows: boolean;

  @doc("whether to include grand totals")
  grandTotal: boolean;
}

@doc("Optional per-request limits (server may clamp / reject)")
model PivotLimits {
  @doc("Maximum number of distinct pivot column combinations allowed")
  maxPivotColumns?: int32;

  @doc("Maximum number of leaf row groups allowed")
  maxRowGroups?: int32;

  @doc("Maximum total pivot cells allowed (rows * pivotColumns * values)")
  maxCells?: int32;
}

@doc("Pivot configuration for server-side pivot preview/export")
model PivotRequest {
  @doc("Row-axis dimensions (ordered)")
  rows: string[];

  @doc("Pivot-axis dimensions (ordered)")
  columns: string[];

  @doc("Pivot measures (one or more)")
  values: PivotValueSpec[];

  @doc("Optional rollup/subtotal settings")
  rollups?: PivotRollupSpec;

  @doc("Optional label to use for blank/null dimension values")
  nullLabel?: string;

  @doc("Optional request-level limits")
  limits?: PivotLimits;
}

@doc("Request body for pivot preview endpoint")
model PivotPreviewRequest {
  @doc("Filter to apply to the dataset")
  filter?: FilterGroup;

  @doc("Pivot configuration")
  pivot: PivotRequest;
}

@doc("Row kind for pivot output")
enum PivotRowKind {
  leaf,
  subtotal,
}

@doc("Per-row metadata for pivot output (used by UI to render rollups consistently)")
model PivotRowMeta {
  kind: PivotRowKind;

  @doc("How many row dimensions are specified for this row")
  level: int32;

  @doc("Raw dimension values for the specified prefix (length level)")
  path: unknown[];

  @doc("Optional display label for subtotal rows")
  label?: string;
}

alias PivotColumnKey = string;

@doc("Pivot column metadata")
model PivotColumn {
  @doc("stable key used in row objects")
  key: PivotColumnKey;

  @doc("Leaf header label")
  headerName: string;

  @doc("Optional type hint for formatting")
  type?: ColumnType;

  @doc("Pivot metadata used to build grouped headers")
  pivotMeta?: {
    pivotKeyPath: string[];
    measure: string;
    agg: PivotAgg;
  };
}

@doc("warning returned for pivot preview/export")
model PivotWarning {
  code: string;
  message: string;
}

@doc("Response from pivot preview endpoint")
model PivotPreviewResponse {
  mode: "pivot";
  columns: PivotColumn[];
  rows: (Record<unknown> & {
    pivot: PivotRowMeta;
  })[];
  totals?: {
    grandTotals?: Record<numeric | null>;
  };
  warnings?: PivotWarning[];
}

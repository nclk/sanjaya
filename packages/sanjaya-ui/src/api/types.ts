/**
 * Sanjaya API types — hand-written ergonomic aliases matching the
 * TypeSpec / OpenAPI specification.
 *
 * These are the types consumed by components and the SanjayaClient
 * interface. They can coexist with (or eventually be replaced by)
 * auto-generated types from `openapi-typescript`.
 */

// ─── Enums ───────────────────────────────────────────────────────────

export type ColumnType =
  | "string"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "datetime"
  | "boolean";

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "startswith"
  | "endswith"
  | "isNull"
  | "isNotNull"
  | "between"
  | "in";

export type FilterCombinator = "and" | "or";

export type FilterStyle = "operators" | "select";

export type AggFunc =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "distinctCount"
  | "first"
  | "last";

export type ExportFormat = "csv" | "xlsx";

export type CurrencyMagnitude = "" | "K" | "M" | "B" | "T";

export type FormatHintKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "currency"
  | "percentage"
  | "basis_points";

export type DynamicReportStatus = "draft" | "published" | "archived";

export type DynamicReportAction =
  | "edit"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore"
  | "share"
  | "favorite"
  | "transferOwnership"
  | "delete";

export type DynamicReportPermission = "viewer" | "editor" | "owner";

export type DynamicReportSortField =
  | "title"
  | "createdAt"
  | "updatedAt"
  | "status";

export type SortDirection = "asc" | "desc";

// ─── Column metadata ─────────────────────────────────────────────────

export interface ColumnFormatHints {
  kind: FormatHintKind;
  decimals?: number;
  currencyCode?: string;
  currencyCodeColumn?: string;
}

export interface ColumnPivotAggOption {
  agg: AggFunc;
  label: string;
}

export interface ColumnPivotOptions {
  role?: "dimension" | "measure";
  allowedAggs?: ColumnPivotAggOption[];
}

export interface CurrencyOptions {
  defaultUnit?: string;
  supportedUnits?: string[];
  defaultMagnitude?: CurrencyMagnitude;
  supportedMagnitudes?: CurrencyMagnitude[];
}

export interface Column {
  name: string;
  label: string;
  type: ColumnType;
  format?: string;
  enumValues?: string[];
  operators: FilterOperator[];
  nullable: boolean;
  currency?: CurrencyOptions;
  pivot?: ColumnPivotOptions;
  formatHints?: ColumnFormatHints;
  filterStyle?: FilterStyle;
}

// ─── Filters ─────────────────────────────────────────────────────────

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value?: unknown;
  not?: boolean;
}

export interface FilterGroup {
  combinator: FilterCombinator;
  not?: boolean;
  conditions: FilterCondition[];
  groups?: FilterGroup[];
}

// ─── AG Grid wire types ──────────────────────────────────────────────

export interface ColumnVO {
  id: string;
  displayName: string;
  field?: string;
  aggFunc?: AggFunc;
}

export interface SortModelItem {
  colId: string;
  sort: SortDirection;
}

export interface SSRMBaseRequest {
  startRow: number;
  endRow: number;
  rowGroupCols: ColumnVO[];
  groupKeys: string[];
  valueCols: ColumnVO[];
  sortModel?: SortModelItem[];
  filter?: FilterGroup;
  filterModel?: Record<string, unknown>;
}

export interface TableGetRowsRequest extends SSRMBaseRequest {}

export interface ServerSideGetRowsRequest extends SSRMBaseRequest {
  pivotCols: ColumnVO[];
  pivotMode: boolean;
}

export interface PivotResultColDef {
  colId: string;
  headerName: string;
  field: string;
  type?: ColumnType;
  children?: PivotResultColDef[];
  pivotMeta?: {
    pivotKeys: string[];
    measure: string;
    agg: AggFunc;
  };
}

export interface ServerSideGetRowsResponse {
  rowData: Record<string, unknown>[];
  rowCount?: number;
  pivotResultFields?: string[];
  secondaryColDefs?: PivotResultColDef[];
}

// ─── Datasets ────────────────────────────────────────────────────────

export interface DatasetCapabilities {
  pivot: boolean;
}

export interface Dataset {
  key: string;
  label: string;
  description: string;
  capabilities: DatasetCapabilities;
}

export interface DatasetsResponse {
  datasets: Dataset[];
}

export interface ColumnsResponse {
  columns: Column[];
}

// ─── Preview ─────────────────────────────────────────────────────────

export interface PreviewRequest {
  selectedColumns: string[];
  filter?: FilterGroup;
  limit?: number;
  offset?: number;
}

export interface PreviewResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  total?: number;
}

// ─── Export ──────────────────────────────────────────────────────────

export interface FlatExportRequest {
  selectedColumns: string[];
  filter?: FilterGroup;
  format: ExportFormat;
}

export interface GroupedExportRequest {
  rowGroupCols: ColumnVO[];
  valueCols: ColumnVO[];
  filterModel?: Record<string, unknown>;
  sortModel?: SortModelItem[];
  format: ExportFormat;
}

export interface PivotExportRequest {
  rowGroupCols: ColumnVO[];
  valueCols: ColumnVO[];
  pivotCols: ColumnVO[];
  filterModel?: Record<string, unknown>;
  sortModel?: SortModelItem[];
  format: ExportFormat;
}

export interface ExportRequest {
  flat?: FlatExportRequest;
  grouped?: GroupedExportRequest;
  pivot?: PivotExportRequest;
}

// ─── Reports ─────────────────────────────────────────────────────────

export interface UserReference {
  id: string;
  name: string;
  email?: string;
}

export interface DynamicReportDefinition {
  datasetKey: string;
  selectedColumns: string[];
  filter: FilterGroup;
  rowGroupCols?: ColumnVO[];
  pivotCols?: ColumnVO[];
  valueCols?: ColumnVO[];
  sortModel?: SortModelItem[];
}

export interface DynamicReportMetadata {
  datasetKey?: string;
  owner?: string;
  definition?: DynamicReportDefinition;
}

export interface DynamicReport {
  id: string;
  title: string;
  description?: string;
  status: DynamicReportStatus;
  createdBy: UserReference;
  createdAt: string;
  updatedBy?: UserReference;
  updatedAt?: string;
  publishedAt?: string;
  publishedBy?: UserReference;
  archivedAt?: string;
  version: number;
  tags?: string[];
  availableActions: DynamicReportAction[];
  metadata?: DynamicReportMetadata;
  isFavorited: boolean;
}

export interface DynamicReportSummary {
  id: string;
  title: string;
  status: DynamicReportStatus;
  createdBy: UserReference;
  updatedAt?: string;
  version: number;
  availableActions: DynamicReportAction[];
  metadata?: DynamicReportMetadata;
  isFavorited: boolean;
}

export interface DynamicReportFilter {
  status?: DynamicReportStatus[];
  createdBy?: string;
  tags?: string[];
  search?: string;
  favorited?: boolean;
  metadata?: Record<string, string[]>;
}

export interface DynamicReportStats {
  total: number;
  drafts: number;
  published: number;
  archived: number;
  byType: Record<string, number>;
}

export interface CreateDynamicReportRequest {
  title: string;
  description?: string;
  tags?: string[];
  metadata?: DynamicReportMetadata;
}

export interface UpdateDynamicReportRequest {
  title?: string;
  description?: string;
  tags?: string[];
  metadata?: DynamicReportMetadata;
}

export interface PerformDynamicReportActionRequest {
  action: DynamicReportAction;
  reason?: string;
  targetUserId?: string;
}

export interface DynamicReportActionResponse {
  report: DynamicReport;
  message: string;
}

export interface ListDynamicReportsResponse {
  reports: DynamicReportSummary[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Shares ──────────────────────────────────────────────────────────

export interface DynamicReportUserShare {
  user: UserReference;
  permission: DynamicReportPermission;
}

export interface DynamicReportGroupShare {
  groupId: string;
  groupName: string;
  permission: DynamicReportPermission;
}

export interface ListDynamicReportSharesResponse {
  users: DynamicReportUserShare[];
  groups: DynamicReportGroupShare[];
}

export interface UpsertDynamicReportUserShareRequest {
  userId: string;
  permission: DynamicReportPermission;
}

export interface DeleteDynamicReportUserShareRequest {
  userId: string;
}

export interface UpsertDynamicReportGroupShareRequest {
  groupId: string;
  permission: DynamicReportPermission;
}

export interface DeleteDynamicReportGroupShareRequest {
  groupId: string;
}

// ─── Error envelopes ─────────────────────────────────────────────────

export interface ErrorDetail {
  error_type: string;
  message: string;
  field?: string;
  path?: unknown;
  location?: string;
}

export interface CustomErrorResponse {
  error: string;
  details: ErrorDetail[];
}

export interface AvailableActionsResponse {
  actions: DynamicReportAction[];
}

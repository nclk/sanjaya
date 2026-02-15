// ---------------------------------------------------------------------------
// Report types — mirror sanjaya_django.schemas.reports + TypeSpec models
// ---------------------------------------------------------------------------

import type { FilterGroup } from "./filters";
import type { ColumnVO, SortModelItem } from "./ssrm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a saved dynamic report.
 */
export enum DynamicReportStatus {
  Draft = "draft",
  Published = "published",
  Archived = "archived",
}

/**
 * Lifecycle actions that can be performed on a saved report.
 *
 * The server returns `availableActions` — a subset of these — per report
 * and per user, reflecting the user's permissions and the report's status.
 */
export enum DynamicReportAction {
  Edit = "edit",
  Publish = "publish",
  Unpublish = "unpublish",
  Archive = "archive",
  Restore = "restore",
  Share = "share",
  Favorite = "favorite",
  TransferOwnership = "transferOwnership",
  Delete = "delete",
}

/**
 * Share permission levels (never `"owner"` — owner is implicit via `createdBy`).
 */
export type SharePermission = "viewer" | "editor";

// ---------------------------------------------------------------------------
// Report definition (stored in metadata.definition)
// ---------------------------------------------------------------------------

/**
 * Normalized report builder payload persisted inside a saved report's
 * metadata.  This is the shape the UI writes on save and expects to read
 * back on load.
 *
 * NOTE: `rowGroupCols`, `pivotCols`, `valueCols`, and `sortModel` are
 * proposed additions tracked in `docs/backend-addenda.md` §1.  Until the
 * backend ships that change, the UI will store them in the opaque
 * `metadata` dict as a forward-compatible extension.
 */
export interface DynamicReportDefinition {
  datasetKey: string;
  selectedColumns: string[];
  filter: FilterGroup;
  /** Row-group columns (table grouped mode and pivot). */
  rowGroupCols?: ColumnVO[];
  /** Pivot cross-tab columns (pivot mode only). */
  pivotCols?: ColumnVO[];
  /** Value/measure columns with aggregate functions. */
  valueCols?: ColumnVO[];
  /** Sort model to restore column sort state. */
  sortModel?: SortModelItem[];
}

// ---------------------------------------------------------------------------
// Report metadata envelope
// ---------------------------------------------------------------------------

export interface DynamicReportMetadata {
  datasetKey?: string;
  owner?: string;
  definition?: DynamicReportDefinition;
}

// ---------------------------------------------------------------------------
// User reference
// ---------------------------------------------------------------------------

export interface UserReference {
  id: string;
  name: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Report models
// ---------------------------------------------------------------------------

/**
 * Full saved dynamic report (returned by get / create / update).
 */
export interface DynamicReport {
  id: number;
  title: string;
  description: string;
  status: DynamicReportStatus;
  createdBy: UserReference;
  createdAt: string;
  updatedBy?: UserReference;
  updatedAt?: string;
  publishedAt?: string;
  publishedBy?: UserReference;
  archivedAt?: string;
  version: number;
  tags: string[];
  availableActions: DynamicReportAction[];
  metadata?: DynamicReportMetadata;
}

/**
 * Slim report summary (used in list responses).
 */
export interface DynamicReportSummary {
  id: number;
  title: string;
  status: DynamicReportStatus;
  createdBy: UserReference;
  updatedAt?: string;
  version: number;
  availableActions: DynamicReportAction[];
  metadata?: DynamicReportMetadata;
}

// ---------------------------------------------------------------------------
// Report CRUD request / response types
// ---------------------------------------------------------------------------

export interface ReportListParams {
  status?: DynamicReportStatus;
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface ReportListResponse {
  reports: DynamicReportSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateReportRequest {
  title: string;
  description?: string;
  tags?: string[];
  metadata?: DynamicReportMetadata;
}

export interface UpdateReportRequest {
  title?: string;
  description?: string;
  tags?: string[];
  metadata?: DynamicReportMetadata;
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export interface UserShareOut {
  user: UserReference;
  permission: SharePermission;
}

export interface GroupShareOut {
  groupId: string;
  groupName: string;
  permission: SharePermission;
}

export interface ShareListResponse {
  users: UserShareOut[];
  groups: GroupShareOut[];
}

export interface UserShareRequest {
  userId: string;
  permission: SharePermission;
}

export interface GroupShareRequest {
  groupId: string;
  permission: SharePermission;
}

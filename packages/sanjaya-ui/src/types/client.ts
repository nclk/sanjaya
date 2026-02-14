// ---------------------------------------------------------------------------
// SanjayaDataClient — the interface the host application implements
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "./columns.js";
import type { DatasetSummary } from "./datasets.js";
import type {
  TableSSRMRequest,
  PivotSSRMRequest,
  SSRMResponse,
  ExportRequest,
} from "./ssrm.js";
import type {
  DynamicReport,
  DynamicReportAction,
  ReportListParams,
  ReportListResponse,
  CreateReportRequest,
  UpdateReportRequest,
  ShareListResponse,
  UserShareRequest,
  GroupShareRequest,
} from "./reports.js";

/**
 * Data-access interface injected into `<sanjaya-report-builder>` by the
 * host application.
 *
 * The report builder components **never** make HTTP calls directly. Instead
 * they call methods on this interface, which the host implements using
 * whatever HTTP client, auth strategy, and endpoint URLs are appropriate.
 *
 * The host can derive an implementation from:
 * - The published TypeSpec spec (compile → openapi.json → codegen)
 * - The generated OpenAPI YAML directly
 * - A hand-rolled `fetch` wrapper
 * - Any other mechanism
 *
 * @example
 * ```ts
 * import type { SanjayaDataClient } from '@pojagi/sanjaya-ui';
 *
 * const client: SanjayaDataClient = {
 *   async listDatasets() {
 *     const res = await fetch('/api/v1/reporting/datasets');
 *     const data = await res.json();
 *     return data.datasets;
 *   },
 *   // … implement remaining methods
 * };
 *
 * const builder = document.querySelector('sanjaya-report-builder')!;
 * builder.client = client;
 * ```
 */
export interface SanjayaDataClient {
  // ----- Dataset operations ------------------------------------------------

  /** List all datasets the current user has access to. */
  listDatasets(): Promise<DatasetSummary[]>;

  /** Fetch rich column metadata for a dataset. */
  getColumns(datasetKey: string): Promise<ColumnMeta[]>;

  // ----- SSRM queries ------------------------------------------------------

  /**
   * AG Grid SSRM query for the table endpoint (flat / grouped, no pivot).
   *
   * The host decides the full URL, e.g. `POST /api/v1/reporting/datasets/{key}/table`.
   */
  queryTable(datasetKey: string, request: TableSSRMRequest): Promise<SSRMResponse>;

  /**
   * AG Grid SSRM query for the pivot endpoint.
   *
   * The host decides the full URL, e.g. `POST /api/v1/reporting/datasets/{key}/pivot`.
   */
  queryPivot(datasetKey: string, request: PivotSSRMRequest): Promise<SSRMResponse>;

  // ----- Export -------------------------------------------------------------

  /**
   * Request a server-driven export (CSV / XLSX).
   *
   * The return type is intentionally flexible — the host may return a `Blob`
   * for client-side download, trigger a browser navigation, or return `void`
   * if it handles the download imperatively.
   */
  exportData(datasetKey: string, request: ExportRequest): Promise<Blob | void>;

  // ----- Report CRUD -------------------------------------------------------

  /** List saved reports with optional filtering, sorting, and pagination. */
  listReports(params?: ReportListParams): Promise<ReportListResponse>;

  /** Get a single saved report by ID. */
  getReport(reportId: string): Promise<DynamicReport>;

  /** Create a new saved report. */
  createReport(payload: CreateReportRequest): Promise<DynamicReport>;

  /** Partially update an existing report. */
  updateReport(reportId: string, payload: UpdateReportRequest): Promise<DynamicReport>;

  /**
   * Perform a lifecycle action on a report (publish, archive, favorite, etc.).
   *
   * @param payload - Action-specific payload (e.g. `{ targetUserId }` for
   *   `transferOwnership`).
   */
  performAction(
    reportId: string,
    action: DynamicReportAction,
    payload?: Record<string, unknown>,
  ): Promise<DynamicReport>;

  // ----- Sharing ------------------------------------------------------------

  /** List all shares for a report. */
  listShares(reportId: string): Promise<ShareListResponse>;

  /** Create or update a user share. */
  upsertUserShare(reportId: string, payload: UserShareRequest): Promise<void>;

  /** Remove a user share. */
  removeUserShare(reportId: string, userId: string): Promise<void>;

  /** Create or update a group share. */
  upsertGroupShare(reportId: string, payload: GroupShareRequest): Promise<void>;

  /** Remove a group share. */
  removeGroupShare(reportId: string, groupId: string): Promise<void>;
}

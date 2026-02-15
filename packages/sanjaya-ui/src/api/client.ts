/**
 * SanjayaClient — the data-access interface that host apps must implement.
 *
 * Sanjaya UI components call these methods via React context. The library
 * ships NO default implementation — the host app injects its own, backed
 * by whatever HTTP client, caching, and auth strategy it already uses.
 *
 * Every method returns a Promise of the corresponding API response type.
 * The host is responsible for HTTP errors; if a method throws, the
 * component will surface the error via its own error-boundary / UI.
 */

import type {
  AvailableActionsResponse,
  ColumnsResponse,
  CreateDynamicReportRequest,
  DatasetsResponse,
  DeleteDynamicReportGroupShareRequest,
  DeleteDynamicReportUserShareRequest,
  DynamicReport,
  DynamicReportActionResponse,
  DynamicReportFilter,
  DynamicReportSortField,
  DynamicReportStats,
  ExportRequest,
  ListDynamicReportSharesResponse,
  ListDynamicReportsResponse,
  PerformDynamicReportActionRequest,
  PreviewRequest,
  PreviewResponse,
  ServerSideGetRowsRequest,
  ServerSideGetRowsResponse,
  SortDirection,
  TableGetRowsRequest,
  UpdateDynamicReportRequest,
  UpsertDynamicReportGroupShareRequest,
  UpsertDynamicReportUserShareRequest,
} from "./types";

// ─── Client interface ────────────────────────────────────────────────

export interface SanjayaClient {
  // Datasets
  listDatasets(): Promise<DatasetsResponse>;
  getColumns(datasetKey: string): Promise<ColumnsResponse>;
  preview(datasetKey: string, body: PreviewRequest): Promise<PreviewResponse>;

  // SSRM endpoints
  tableQuery(
    datasetKey: string,
    body: TableGetRowsRequest,
  ): Promise<ServerSideGetRowsResponse>;
  pivotQuery(
    datasetKey: string,
    body: ServerSideGetRowsRequest,
  ): Promise<ServerSideGetRowsResponse>;

  // Export (returns a Blob — the host streams it to the user)
  exportData(datasetKey: string, body: ExportRequest): Promise<Blob>;

  // Reports CRUD
  listReports(params?: {
    filter?: DynamicReportFilter;
    sortBy?: DynamicReportSortField;
    sortOrder?: SortDirection;
    limit?: number;
    offset?: number;
  }): Promise<ListDynamicReportsResponse>;
  getReport(reportId: string): Promise<DynamicReport>;
  createReport(body: CreateDynamicReportRequest): Promise<DynamicReport>;
  updateReport(
    reportId: string,
    body: UpdateDynamicReportRequest,
  ): Promise<DynamicReport>;

  // Report lifecycle actions
  getAvailableActions(reportId: string): Promise<AvailableActionsResponse>;
  performAction(
    reportId: string,
    body: PerformDynamicReportActionRequest,
  ): Promise<DynamicReportActionResponse>;
  getReportStats(): Promise<DynamicReportStats>;

  // Shares
  listShares(reportId: string): Promise<ListDynamicReportSharesResponse>;
  upsertUserShare(
    reportId: string,
    body: UpsertDynamicReportUserShareRequest,
  ): Promise<ListDynamicReportSharesResponse>;
  deleteUserShare(
    reportId: string,
    body: DeleteDynamicReportUserShareRequest,
  ): Promise<ListDynamicReportSharesResponse>;
  upsertGroupShare(
    reportId: string,
    body: UpsertDynamicReportGroupShareRequest,
  ): Promise<ListDynamicReportSharesResponse>;
  deleteGroupShare(
    reportId: string,
    body: DeleteDynamicReportGroupShareRequest,
  ): Promise<ListDynamicReportSharesResponse>;
}

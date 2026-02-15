// ---------------------------------------------------------------------------
// SanjayaDataClient — fetch-based implementation for the Django demo API
// ---------------------------------------------------------------------------

import type {
  SanjayaDataClient,
  DatasetSummary,
  ColumnMeta,
  TableSSRMRequest,
  PivotSSRMRequest,
  SSRMResponse,
  ExportRequest,
  DynamicReport,
  DynamicReportAction,
  ReportListParams,
  ReportListResponse,
  CreateReportRequest,
  UpdateReportRequest,
  ShareListResponse,
  UserShareRequest,
  GroupShareRequest,
} from "@pojagi/sanjaya-ui";

const BASE = "http://localhost:8000/api/v1/reporting";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function del<T>(path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method: "DELETE" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createClient(): SanjayaDataClient {
  return {
    // ---- Datasets --------------------------------------------------------

    async listDatasets(): Promise<DatasetSummary[]> {
      const data = await get<{ datasets: DatasetSummary[] }>("/datasets/");
      return data.datasets;
    },

    async getColumns(datasetKey: string): Promise<ColumnMeta[]> {
      const data = await get<{ columns: ColumnMeta[] }>(
        `/datasets/${datasetKey}/columns/`,
      );
      return data.columns;
    },

    // ---- SSRM queries ----------------------------------------------------

    async queryTable(
      datasetKey: string,
      request: TableSSRMRequest,
    ): Promise<SSRMResponse> {
      return post(`/datasets/${datasetKey}/table/`, request);
    },

    async queryPivot(
      datasetKey: string,
      request: PivotSSRMRequest,
    ): Promise<SSRMResponse> {
      return post(`/datasets/${datasetKey}/pivot/`, request);
    },

    // ---- Export -----------------------------------------------------------

    async exportData(
      datasetKey: string,
      request: ExportRequest,
    ): Promise<Blob | void> {
      const res = await fetch(`${BASE}/datasets/${datasetKey}/export/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(`Export → ${res.status}`);
      return res.blob();
    },

    // ---- Report CRUD -----------------------------------------------------

    async listReports(params?: ReportListParams): Promise<ReportListResponse> {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      if (params?.sort) qs.set("sort_by", params.sort);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const query = qs.toString() ? `?${qs.toString()}` : "";
      return get(`/reports/${query}`);
    },

    async getReport(reportId: string): Promise<DynamicReport> {
      return get(`/reports/${reportId}`);
    },

    async createReport(payload: CreateReportRequest): Promise<DynamicReport> {
      return post("/reports/", payload);
    },

    async updateReport(
      reportId: string,
      payload: UpdateReportRequest,
    ): Promise<DynamicReport> {
      return patch(`/reports/${reportId}`, payload);
    },

    async performAction(
      reportId: string,
      action: DynamicReportAction,
      payload?: Record<string, unknown>,
    ): Promise<DynamicReport> {
      const body = { action, ...(payload ?? {}) };
      const data = await post<{ report: DynamicReport }>(
        `/reports/${reportId}/actions/`,
        body,
      );
      return data.report;
    },

    // ---- Sharing ---------------------------------------------------------

    async listShares(reportId: string): Promise<ShareListResponse> {
      return get(`/reports/${reportId}/shares/`);
    },

    async upsertUserShare(
      reportId: string,
      payload: UserShareRequest,
    ): Promise<void> {
      await post(`/reports/${reportId}/shares/users/`, payload);
    },

    async removeUserShare(
      reportId: string,
      userId: string,
    ): Promise<void> {
      await del(`/reports/${reportId}/shares/users/`, { user_id: userId });
    },

    async upsertGroupShare(
      reportId: string,
      payload: GroupShareRequest,
    ): Promise<void> {
      await post(`/reports/${reportId}/shares/groups/`, payload);
    },

    async removeGroupShare(
      reportId: string,
      groupId: string,
    ): Promise<void> {
      await del(`/reports/${reportId}/shares/groups/`, { group_id: groupId });
    },
  };
}

/** Pre-built singleton — import this for convenience. */
export const client: SanjayaDataClient = createClient();

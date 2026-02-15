import "../../models/dynamic-reports.tsp";
using TypeSpec.Http;
using Models;

@route("/reporting")
namespace Rest.Api.V1.DynamicReporting {
  @route("/reports/")
  namespace Reports {
    @doc("List saved dynamic reports")
    @get
    op list(
      @query filter?: DynamicReportFilter,
      @query limit?: int32,
      @query offset?: int32,
      @query sortBy?: DynamicReportSortField,
      @query sortOrder?: "asc" | "desc",
    ): ListDynamicReportsResponse | CustomErrorResponse500 | ValidationErrorResponse;
    @doc("Create a saved dynamic report")
    @post
    op create(@body body: CreateDynamicReportRequest):
      | DynamicReport
      | CustomErrorResponse400
      | CustomErrorResponse500
      | ValidationErrorResponse;
    @route("{reportId}")
    namespace Report {
      @doc("Get a saved dynamic report") @get op get(
        @path reportId: string,
      ): DynamicReport | CustomErrorResponse404;
      @doc("Update a saved dynamic report")
      @patch(#{ implicitOptionality: true })
      op update(
        @path reportId: string,
        @body body: UpdateDynamicReportRequest,
      ):
        | DynamicReport
        | CustomErrorResponse400
        | CustomErrorResponse404
        | ValidationErrorResponse;
      @route("actions/")
      namespace Actions {
        @doc("Get available lifecycle actions for a report") @get op list(
          @path reportId: string,
        ): {
          actions: DynamicReportAction[];
        } | CustomErrorResponse404;
        @doc("Perform lifecycle action on a report") @post op perform(
          @path reportId: string,
          @body body: PerformDynamicReportActionRequest,
        ):
          | DynamicReportActionResponse
          | CustomErrorResponse400
          | CustomErrorResponse404
          | ValidationErrorResponse;
      }
    }
    @route("stats/")
    @doc("Get overall saved report stats")
    @get
    op stats(): DynamicReportStats | CustomErrorResponse500;
  }
  @route("/reports/{reportId}/shares/")
  namespace Shares {
    @doc("List all user/group shares for a report (owner only)") @get op list(
      @path reportId: string,
    ): ListDynamicReportSharesResponse | CustomErrorResponse404 | PermissionErrorResponse;
    @route("users/")
    namespace Users {
      @doc("Create or update a user share (owner only)") @post op upsert(
        @path reportId: string,
        @body body: UpsertDynamicReportUserShareRequest,
      ):
        | ListDynamicReportSharesResponse
        | CustomErrorResponse400
        | CustomErrorResponse404
        | ValidationErrorResponse
        | PermissionErrorResponse;
      @doc("Delete a user share (owner only)") @delete op delete(
        @path reportId: string,
        @body body: DeleteDynamicReportUserShareRequest,
      ):
        | ListDynamicReportSharesResponse
        | CustomErrorResponse404
        | ValidationErrorResponse
        | PermissionErrorResponse;
    }
    @route("groups/")
    namespace Groups {
      @doc("Create or update a group share (owner only)") @post op upsert(
        @path reportId: string,
        @body body: UpsertDynamicReportGroupShareRequest,
      ):
        | ListDynamicReportSharesResponse
        | CustomErrorResponse400
        | CustomErrorResponse404
        | ValidationErrorResponse
        | PermissionErrorResponse;
      @doc("Delete a group share (owner only)") @delete op delete(
        @path reportId: string,
        @body body: DeleteDynamicReportGroupShareRequest,
      ):
        | ListDynamicReportSharesResponse
        | CustomErrorResponse404
        | ValidationErrorResponse
        | PermissionErrorResponse;
    }
  }
  @route("/datasets/")
  namespace Datasets {
    @doc("Get list of available datasets") @get op list(
    ): DatasetsResponse | CustomErrorResponse500;
    @route("{datasetKey}")
    namespace DatasetOperations {
      @route("columns/")
      @doc("Get column metadata for a dataset")
      @get
      op getColumns(
        @path datasetKey: string,
      ): ColumnsResponse | CustomErrorResponse404;
      @route("preview/")
      @doc("Preview filtered dataset")
      @post
      op preview(@path datasetKey: string, @body body: PreviewRequest):
        | PreviewResponse
        | CustomErrorResponse400
        | CustomErrorResponse404
        | ValidationErrorResponse;
      @route("export/")
      @doc("Export filtered dataset")
      @post
      op export(@path datasetKey: string, @body body: ExportRequest):
        | {
            @header
            contentType: "text/csv" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

            @body data: bytes;
          }
        | CustomErrorResponse400
        | CustomErrorResponse404
        | ValidationErrorResponse;
      @route("table/")
      @doc("AG Grid Server-Side Row Model endpoint for flat data, row grouping, and aggregation (no pivot). Supports filtering, sorting, pagination, and drill-down via groupKeys.")
      @post
      op table(@path datasetKey: string, @body body: TableGetRowsRequest):
        | ServerSideGetRowsResponse
        | CustomErrorResponse400
        | CustomErrorResponse404
        | ValidationErrorResponse;
      @route("pivot/")
      @doc("AG Grid Server-Side Row Model endpoint for pivot queries. Requires pivotMode: true and at least one pivot column. Returns 400 if pivot columns are missing. Use the /table endpoint for non-pivot queries.")
      @post
      op pivot(@path datasetKey: string, @body body: ServerSideGetRowsRequest):
        | ServerSideGetRowsResponse
        | CustomErrorResponse501
        | CustomErrorResponse400
        | CustomErrorResponse404
        | ValidationErrorResponse;
    }
  }
}

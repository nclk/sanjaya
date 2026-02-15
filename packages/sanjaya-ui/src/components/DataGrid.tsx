/**
 * DataGrid — AG Grid Enterprise SSRM wrapper for table and pivot modes.
 *
 * Implements a custom `IServerSideDatasource` that reads structural params
 * (pagination, groupKeys, sortModel) from AG Grid and injects semantic
 * params (filter, rowGroupCols, valueCols, pivotCols) from props — matching
 * the integration pattern described in ui-integration-notes.md.
 *
 * The component toggles between two endpoints:
 *   - Table: POST /datasets/{key}/table  (flat + row grouping)
 *   - Pivot: POST /datasets/{key}/pivot  (cross-tab)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  SortChangedEvent,
} from "ag-grid-community";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useSanjayaClient } from "../providers/SanjayaProvider";
import type {
  ActiveTab,
} from "../state/reportBuilderState";
import type {
  Column,
  ColumnVO,
  FilterGroup,
  SortModelItem,
} from "../api/types";

// ─── Props ───────────────────────────────────────────────────────────

export interface DataGridProps {
  datasetKey: string;
  /** Column metadata for building AG Grid ColDefs */
  columns: Column[];
  /** Visible column names */
  selectedColumns: string[];
  /** Current filter tree from the filter builder */
  filterGroup: FilterGroup;
  /** Row group columns */
  rowGroupCols: ColumnVO[];
  /** Pivot columns (only used in pivot tab) */
  pivotCols: ColumnVO[];
  /** Value/measure columns with aggFunc */
  valueCols: ColumnVO[];
  /** Sort model */
  sortModel: SortModelItem[];
  /** Active tab */
  activeTab: ActiveTab;
  /** Whether pivot capability is available for this dataset */
  pivotCapable?: boolean;
  /** Called when the active tab changes */
  onActiveTabChange: (tab: ActiveTab) => void;
  /** Called when sort model changes via grid interaction */
  onSortModelChange: (sortModel: SortModelItem[]) => void;
}

// ─── Column def builder ──────────────────────────────────────────────

function buildColDefs(
  columns: Column[],
  selectedColumns: string[],
  rowGroupCols: ColumnVO[],
  valueCols: ColumnVO[],
): ColDef[] {
  const selectedSet = new Set(selectedColumns);
  const rowGroupSet = new Set(rowGroupCols.map((c) => c.id));
  const valueMap = new Map(valueCols.map((c) => [c.id, c.aggFunc]));

  return columns
    .filter((col) => selectedSet.size === 0 || selectedSet.has(col.name))
    .map((col) => {
      const def: ColDef = {
        field: col.name,
        headerName: col.label,
        sortable: true,
        resizable: true,
      };

      if (rowGroupSet.has(col.name)) {
        def.rowGroup = true;
        def.hide = true;
      }

      const agg = valueMap.get(col.name);
      if (agg) {
        def.aggFunc = agg;
        def.enableValue = true;
      }

      return def;
    });
}

// ─── Component ───────────────────────────────────────────────────────

export function DataGrid({
  datasetKey,
  columns,
  selectedColumns,
  filterGroup,
  rowGroupCols,
  pivotCols,
  valueCols,
  sortModel,
  activeTab,
  pivotCapable = false,
  onActiveTabChange,
  onSortModelChange,
}: DataGridProps) {
  const client = useSanjayaClient();
  const gridRef = useRef<AgGridReact>(null);
  const apiRef = useRef<GridApi | null>(null);

  // ── Column defs ──────────────────────────────────────────────────

  const colDefs = useMemo(
    () => buildColDefs(columns, selectedColumns, rowGroupCols, valueCols),
    [columns, selectedColumns, rowGroupCols, valueCols],
  );

  // ── Datasource ──────────────────────────────────────────────────

  const datasource = useMemo<IServerSideDatasource>(
    () => ({
      getRows(params: IServerSideGetRowsParams) {
        const req = params.request;

        const baseBody = {
          startRow: req.startRow ?? 0,
          endRow: req.endRow ?? 100,
          rowGroupCols: rowGroupCols,
          groupKeys: req.groupKeys ?? [],
          valueCols: valueCols,
          sortModel: sortModel.length > 0 ? sortModel : undefined,
          filter: filterGroup.conditions.length > 0 ||
            (filterGroup.groups?.length ?? 0) > 0
            ? filterGroup
            : undefined,
        };

        const promise =
          activeTab === "pivot"
            ? client.pivotQuery(datasetKey, {
                ...baseBody,
                pivotCols,
                pivotMode: true,
              })
            : client.tableQuery(datasetKey, baseBody);

        promise
          .then((response) => {
            // Apply pivot result columns if present
            if (
              activeTab === "pivot" &&
              response.secondaryColDefs &&
              apiRef.current
            ) {
              apiRef.current.setPivotResultColumns(
                response.secondaryColDefs as unknown as ColDef[],
              );
            }

            params.success({
              rowData: response.rowData,
              rowCount: response.rowCount ?? undefined,
            });
          })
          .catch(() => {
            params.fail();
          });
      },
    }),
    [
      client,
      datasetKey,
      filterGroup,
      rowGroupCols,
      pivotCols,
      valueCols,
      sortModel,
      activeTab,
    ],
  );

  // ── Refresh on dependency changes ─────────────────────────────

  useEffect(() => {
    if (apiRef.current) {
      apiRef.current.refreshServerSide({ purge: true });
    }
  }, [datasource]);

  // ── Grid event handlers ───────────────────────────────────────

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    apiRef.current = event.api;
  }, []);

  const handleSortChanged = useCallback(
    (event: SortChangedEvent) => {
      const agSortModel = event.api.getColumnState()
        .filter((c) => c.sort)
        .map((c) => ({
          colId: c.colId,
          sort: c.sort as "asc" | "desc",
        }));
      onSortModelChange(agSortModel);
    },
    [onSortModelChange],
  );

  // ── Tab change ────────────────────────────────────────────────

  const handleTabChange = useCallback(
    (_: unknown, newTab: ActiveTab) => {
      onActiveTabChange(newTab);
    },
    [onActiveTabChange],
  );

  // ── Render ────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 1 }}>
        <Tab label="Table" value="table" />
        {pivotCapable && <Tab label="Pivot" value="pivot" />}
      </Tabs>

      <Box sx={{ flex: 1 }} className="ag-theme-material">
        <AgGridReact
          ref={gridRef}
          columnDefs={colDefs}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          pivotMode={activeTab === "pivot"}
          onGridReady={handleGridReady}
          onSortChanged={handleSortChanged}
          suppressServerSideInfiniteScroll={false}
          cacheBlockSize={100}
          maxBlocksInCache={10}
          defaultColDef={{
            sortable: true,
            resizable: true,
            flex: 1,
            minWidth: 100,
          }}
          animateRows
          enableRangeSelection
        />
      </Box>
    </Box>
  );
}

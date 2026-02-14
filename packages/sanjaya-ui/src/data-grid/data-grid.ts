// ---------------------------------------------------------------------------
// <sj-data-grid> — AG Grid SSRM data viewer with Table + Pivot tabs
//
// Renders AG Grid Enterprise in SSRM mode, driven by a
// DynamicReportDefinition. Two tabs: "Table" (flat / grouped) and
// "Pivot" (cross-tab). Grids are lazily initialized on first tab
// activation to avoid unnecessary AG Grid instantiation.
// ---------------------------------------------------------------------------

import type { SanjayaDataClient } from "../types/client.js";
import type { ColumnMeta } from "../types/columns.js";
import type { DynamicReportDefinition } from "../types/reports.js";
import type { SSRMResponse } from "../types/ssrm.js";
import { emit } from "../shared/events.js";
import { template } from "./template.js";

import type { GridColDef, SSRMGetRowsParams } from "./helpers.js";
import {
  tableColDefs,
  pivotSecondaryColDefs,
  buildTableRequest,
  buildPivotRequest,
  isPivotReady,
} from "./helpers.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// AG Grid API stand-in types (minimal)
//
// We define only the methods we actually call so the component compiles
// without ag-grid-enterprise in devDependencies.
// ---------------------------------------------------------------------------

interface GridApi {
  setGridOption(key: string, value: unknown): void;
  updateGridOptions(opts: Record<string, unknown>): void;
  refreshServerSide(params?: { purge?: boolean }): void;
  setColumnDefs(colDefs: GridColDef[]): void;
  destroy(): void;
}

interface CreateGridParams {
  columnDefs?: GridColDef[];
  rowModelType?: string;
  serverSideDatasource?: {
    getRows: (params: SSRMGetRowsParams) => void;
  };
  cacheBlockSize?: number;
  maxBlocksInCache?: number;
  pivotMode?: boolean;
  defaultColDef?: Record<string, unknown>;
  animateRows?: boolean;
  suppressAggFuncInHeader?: boolean;
  [key: string]: unknown;
}

/**
 * AG Grid's `createGrid` function signature. We declare it here instead
 * of importing from `ag-grid-enterprise` so the component compiles
 * without that package installed (it's a peer dep).
 */
type CreateGridFn = (
  element: HTMLElement,
  options: CreateGridParams,
) => GridApi;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DataGridTab = "table" | "pivot";

/** Detail payload for the `tab-change` event. */
export interface TabChangeDetail {
  tab: DataGridTab;
}

/** Detail payload for the `grid-ready` event. */
export interface GridReadyDetail {
  api: unknown; // GridApi — typed as `unknown` for consumers without AG Grid types
  tab: DataGridTab;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-data-grid>` — AG Grid SSRM data viewer.
 *
 * @fires tab-change — Emitted when the user switches between Table/Pivot tabs.
 * @fires grid-ready — Emitted when an AG Grid instance is created.
 */
export class SanjayaDataGrid extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  get client(): SanjayaDataClient | null {
    return this._client;
  }

  set client(value: SanjayaDataClient | null) {
    this._client = value;
  }

  get datasetKey(): string | null {
    return this._datasetKey;
  }

  set datasetKey(value: string | null) {
    if (value === this._datasetKey) return;
    this._datasetKey = value;
    this._columnsMeta = [];
    this._destroyGrids();
    this._updatePlaceholders();
    if (value && this._client) {
      this._loadColumns(value);
    }
  }

  get definition(): DynamicReportDefinition | null {
    return this._definition;
  }

  set definition(value: DynamicReportDefinition | null) {
    const prev = this._definition;
    this._definition = value;
    this._onDefinitionChange(prev, value);
  }

  get activeTab(): DataGridTab {
    return this._activeTab;
  }

  set activeTab(value: DataGridTab) {
    if (value === this._activeTab) return;
    this._activeTab = value;
    this._syncTabs();
  }

  // Callback props (alternative to addEventListener)
  onTabChange?: (detail: TabChangeDetail) => void;
  onGridReady?: (detail: GridReadyDetail) => void;

  // ----- Internals --------------------------------------------------------

  private _client: SanjayaDataClient | null = null;
  private _datasetKey: string | null = null;
  private _definition: DynamicReportDefinition | null = null;
  private _activeTab: DataGridTab = "table";
  private _columnsMeta: ColumnMeta[] = [];

  private _tableApi: GridApi | null = null;
  private _pivotApi: GridApi | null = null;
  private _tableInitialized = false;
  private _pivotInitialized = false;

  private _shadow: ShadowRoot;

  /** Injected AG Grid `createGrid` function — set via static or instance. */
  static createGrid: CreateGridFn | null = null;
  createGrid: CreateGridFn | null = null;

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._shadow.appendChild(tpl.content.cloneNode(true));
  }

  connectedCallback(): void {
    this._bindTabBar();
    this._syncTabs();
    this._updatePlaceholders();
  }

  disconnectedCallback(): void {
    this._destroyGrids();
  }

  // ----- Tab management ---------------------------------------------------

  private _tabClickBound = false;

  private _bindTabBar(): void {
    if (this._tabClickBound) return;
    this._tabClickBound = true;
    const buttons = this._shadow.querySelectorAll<HTMLButtonElement>(".tab-btn");
    for (const btn of buttons) {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab as DataGridTab | undefined;
        if (tab && tab !== this._activeTab) {
          this._activeTab = tab;
          this._syncTabs();
          emit(this, "tab-change", { tab } satisfies TabChangeDetail);
        }
      });
    }
  }

  private _syncTabs(): void {
    // Update aria-selected on tab buttons
    const buttons = this._shadow.querySelectorAll<HTMLButtonElement>(".tab-btn");
    buttons.forEach((btn) => {
      btn.setAttribute(
        "aria-selected",
        btn.dataset.tab === this._activeTab ? "true" : "false",
      );
    });

    // Toggle panel visibility
    const tablePanel = this._shadow.getElementById("panel-table");
    const pivotPanel = this._shadow.getElementById("panel-pivot");
    if (tablePanel) {
      if (this._activeTab === "table") {
        tablePanel.setAttribute("data-active", "");
      } else {
        tablePanel.removeAttribute("data-active");
      }
    }
    if (pivotPanel) {
      if (this._activeTab === "pivot") {
        pivotPanel.setAttribute("data-active", "");
      } else {
        pivotPanel.removeAttribute("data-active");
      }
    }

    // Disable pivot tab when pivot isn't ready
    const pivotBtn = this._shadow.querySelector<HTMLButtonElement>(
      '.tab-btn[data-tab="pivot"]',
    );
    if (pivotBtn) {
      pivotBtn.disabled = !isPivotReady(this._definition);
    }

    // Lazy-initialize grid for the active tab
    this._ensureGrid(this._activeTab);
  }

  // ----- Placeholder management -------------------------------------------

  private _updatePlaceholders(): void {
    const tablePH = this._shadow.getElementById("placeholder-table");
    const pivotPH = this._shadow.getElementById("placeholder-pivot");
    const tableGrid = this._shadow.getElementById("grid-table");
    const pivotGrid = this._shadow.getElementById("grid-pivot");

    const hasDataset = !!this._datasetKey;
    const hasPivot = isPivotReady(this._definition);

    if (tablePH) {
      tablePH.style.display =
        hasDataset && this._tableInitialized ? "none" : "flex";
      tablePH.textContent = hasDataset
        ? "Loading…"
        : "Select a dataset to view data";
    }
    if (tableGrid) {
      tableGrid.style.display =
        hasDataset && this._tableInitialized ? "block" : "none";
    }
    if (pivotPH) {
      pivotPH.style.display =
        hasPivot && this._pivotInitialized ? "none" : "flex";
      pivotPH.textContent = hasPivot
        ? "Loading…"
        : "Configure pivot settings to view data";
    }
    if (pivotGrid) {
      pivotGrid.style.display =
        hasPivot && this._pivotInitialized ? "block" : "none";
    }
  }

  // ----- Column loading ---------------------------------------------------

  private async _loadColumns(datasetKey: string): Promise<void> {
    if (!this._client) return;
    try {
      this._columnsMeta = await this._client.getColumns(datasetKey);
      // Now that we have columns, try initializing the active tab
      this._ensureGrid(this._activeTab);
    } catch {
      // Silently fail — consumer can check via grid-ready event absence
    }
  }

  // ----- Grid lifecycle ---------------------------------------------------

  private _getCreateGrid(): CreateGridFn | null {
    return this.createGrid ?? SanjayaDataGrid.createGrid ?? null;
  }

  private _ensureGrid(tab: DataGridTab): void {
    const factory = this._getCreateGrid();
    if (!factory) return;
    if (!this._datasetKey || !this._client) return;
    if (this._columnsMeta.length === 0) return;

    if (tab === "table" && !this._tableInitialized) {
      this._initTableGrid(factory);
    } else if (tab === "pivot" && !this._pivotInitialized) {
      if (isPivotReady(this._definition)) {
        this._initPivotGrid(factory);
      }
    }
  }

  private _initTableGrid(factory: CreateGridFn): void {
    const container = this._shadow.getElementById("grid-table");
    if (!container) return;

    const colDefs = this._definition
      ? tableColDefs(this._definition, this._columnsMeta)
      : this._columnsMeta.map((c) => ({
          colId: c.name,
          field: c.name,
          headerName: c.label,
        }));

    const api = factory(container, {
      columnDefs: colDefs,
      rowModelType: "serverSide",
      serverSideDatasource: {
        getRows: (params: SSRMGetRowsParams) =>
          this._onTableGetRows(params),
      },
      cacheBlockSize: 100,
      maxBlocksInCache: 10,
      defaultColDef: {
        sortable: true,
        resizable: true,
        minWidth: 80,
      },
      animateRows: false,
      suppressAggFuncInHeader: true,
    });

    this._tableApi = api;
    this._tableInitialized = true;
    this._updatePlaceholders();
    emit(this, "grid-ready", { api, tab: "table" } satisfies GridReadyDetail);
  }

  private _initPivotGrid(factory: CreateGridFn): void {
    const container = this._shadow.getElementById("grid-pivot");
    if (!container) return;
    if (!this._definition) return;

    const api = factory(container, {
      columnDefs: [],
      rowModelType: "serverSide",
      serverSideDatasource: {
        getRows: (params: SSRMGetRowsParams) =>
          this._onPivotGetRows(params),
      },
      cacheBlockSize: 100,
      maxBlocksInCache: 10,
      pivotMode: true,
      defaultColDef: {
        sortable: true,
        resizable: true,
        minWidth: 80,
      },
      animateRows: false,
      suppressAggFuncInHeader: false,
    });

    this._pivotApi = api;
    this._pivotInitialized = true;
    this._updatePlaceholders();
    emit(this, "grid-ready", { api, tab: "pivot" } satisfies GridReadyDetail);
  }

  private _destroyGrids(): void {
    if (this._tableApi) {
      this._tableApi.destroy();
      this._tableApi = null;
    }
    if (this._pivotApi) {
      this._pivotApi.destroy();
      this._pivotApi = null;
    }
    this._tableInitialized = false;
    this._pivotInitialized = false;
  }

  // ----- SSRM datasource handlers ----------------------------------------

  private async _onTableGetRows(params: SSRMGetRowsParams): Promise<void> {
    if (!this._client || !this._datasetKey || !this._definition) {
      params.fail();
      return;
    }

    try {
      const request = buildTableRequest(params, this._definition);
      const response: SSRMResponse = await this._client.queryTable(
        this._datasetKey,
        request,
      );
      params.success({
        rowData: response.rowData,
        rowCount: response.rowCount,
      });
    } catch {
      params.fail();
    }
  }

  private async _onPivotGetRows(params: SSRMGetRowsParams): Promise<void> {
    if (!this._client || !this._datasetKey || !this._definition) {
      params.fail();
      return;
    }

    try {
      const request = buildPivotRequest(params, this._definition);
      const response: SSRMResponse = await this._client.queryPivot(
        this._datasetKey,
        request,
      );

      // Apply secondary column defs from the pivot response
      if (response.secondaryColDefs && this._pivotApi) {
        const secondary = pivotSecondaryColDefs(response.secondaryColDefs);
        this._pivotApi.updateGridOptions({ columnDefs: secondary });
      }

      params.success({
        rowData: response.rowData,
        rowCount: response.rowCount,
      });
    } catch {
      params.fail();
    }
  }

  // ----- Definition change handling ---------------------------------------

  private _onDefinitionChange(
    prev: DynamicReportDefinition | null,
    next: DynamicReportDefinition | null,
  ): void {
    // Update pivot tab enabled state
    this._syncTabs();

    if (!next) {
      this._destroyGrids();
      this._updatePlaceholders();
      return;
    }

    // If dataset changed, reset everything
    if (next.datasetKey !== prev?.datasetKey) {
      this._destroyGrids();
      this._datasetKey = next.datasetKey;
      this._columnsMeta = [];
      this._updatePlaceholders();
      if (this._client) {
        this._loadColumns(next.datasetKey);
      }
      return;
    }

    // Table: update column defs + refresh data
    if (this._tableApi && this._columnsMeta.length > 0) {
      const newColDefs = tableColDefs(next, this._columnsMeta);
      this._tableApi.setColumnDefs(newColDefs);
      this._tableApi.refreshServerSide({ purge: true });
    }

    // Pivot: if it's now ready and not yet initialized, init it
    if (isPivotReady(next) && !this._pivotInitialized) {
      this._ensureGrid("pivot");
    } else if (this._pivotApi) {
      // Refresh pivot data with new definition
      this._pivotApi.refreshServerSide({ purge: true });
    }
  }
}

// ---------------------------------------------------------------------------
// Register custom element
// ---------------------------------------------------------------------------

customElements.define("sj-data-grid", SanjayaDataGrid);

// ---------------------------------------------------------------------------
// Tests for <sj-data-grid> — component behavior with mocked AG Grid API
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import type { SanjayaDataClient } from "../src/types/client";
import type { DynamicReportDefinition } from "../src/types/reports";
import { ColumnType, FilterCombinator, FilterOperator } from "../src/types/index";
import type { ColumnMeta } from "../src/types/columns";
import { AggFunc } from "../src/types/ssrm";
import "../src/data-grid/data-grid.js";
import { SanjayaDataGrid } from "../src/data-grid/data-grid";
import type { TabChangeDetail, GridReadyDetail } from "../src/data-grid/data-grid";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mockClient(): SanjayaDataClient {
  return {
    listDatasets: vi.fn().mockResolvedValue([]),
    getColumns: vi.fn().mockResolvedValue([
      {
        name: "order_id",
        label: "Order ID",
        type: ColumnType.Number,
        operators: [FilterOperator.Equals],
        nullable: false,
      },
      {
        name: "customer",
        label: "Customer",
        type: ColumnType.String,
        operators: [FilterOperator.Equals],
        nullable: false,
      },
      {
        name: "amount",
        label: "Amount",
        type: ColumnType.Currency,
        operators: [FilterOperator.Equals],
        nullable: false,
        formatHints: { kind: "currency" as const, currencyCode: "USD", decimals: 2 },
      },
    ] satisfies ColumnMeta[]),
    queryTable: vi.fn().mockResolvedValue({ rowData: [], rowCount: 0 }),
    queryPivot: vi.fn().mockResolvedValue({ rowData: [], rowCount: 0 }),
    exportData: vi.fn(),
    listReports: vi.fn(),
    getReport: vi.fn(),
    createReport: vi.fn(),
    updateReport: vi.fn(),
    performAction: vi.fn(),
    listShares: vi.fn(),
    upsertUserShare: vi.fn(),
    removeUserShare: vi.fn(),
    upsertGroupShare: vi.fn(),
    removeGroupShare: vi.fn(),
  } as unknown as SanjayaDataClient;
}

function makeDefinition(
  overrides: Partial<DynamicReportDefinition> = {},
): DynamicReportDefinition {
  return {
    datasetKey: "orders",
    selectedColumns: ["order_id", "customer", "amount"],
    filter: { combinator: FilterCombinator.And },
    ...overrides,
  };
}

/** Create a mock AG Grid API instance. */
function mockGridApi() {
  return {
    setGridOption: vi.fn(),
    updateGridOptions: vi.fn(),
    refreshServerSide: vi.fn(),
    destroy: vi.fn(),
  };
}

/** Create a mock `createGrid` factory that returns a controllable API. */
function mockCreateGrid() {
  const api = mockGridApi();
  const factory = vi.fn().mockReturnValue(api);
  return { factory, api };
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createElement(): SanjayaDataGrid {
  const el = document.createElement("sj-data-grid") as SanjayaDataGrid;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  // Clean up DOM and reset static
  document.body.innerHTML = "";
  SanjayaDataGrid.createGrid = null;
});

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe("<sj-data-grid> rendering", () => {
  it("is registered as a custom element", () => {
    expect(customElements.get("sj-data-grid")).toBe(SanjayaDataGrid);
  });

  it("renders tab bar with Table and Pivot buttons", () => {
    const el = createElement();
    const shadow = el.shadowRoot!;
    const tabs = shadow.querySelectorAll(".tab-btn");
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toBe("Table");
    expect(tabs[1].textContent).toBe("Pivot");
  });

  it("Table tab is selected by default", () => {
    const el = createElement();
    const shadow = el.shadowRoot!;
    const tableBtn = shadow.querySelector('[data-tab="table"]') as HTMLButtonElement;
    expect(tableBtn.getAttribute("aria-selected")).toBe("true");
    const tablePanel = shadow.getElementById("panel-table")!;
    expect(tablePanel.hasAttribute("data-active")).toBe(true);
  });

  it("shows placeholder when no dataset", () => {
    const el = createElement();
    const ph = el.shadowRoot!.getElementById("placeholder-table")!;
    expect(ph.style.display).not.toBe("none");
    expect(ph.textContent).toContain("Select a dataset");
  });
});

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

describe("<sj-data-grid> tab switching", () => {
  it("programmatic activeTab switches panels", () => {
    const el = createElement();
    const { factory } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    el.activeTab = "pivot";
    const shadow = el.shadowRoot!;

    const pivotBtn = shadow.querySelector('[data-tab="pivot"]') as HTMLButtonElement;
    expect(pivotBtn.getAttribute("aria-selected")).toBe("true");

    const tablePanel = shadow.getElementById("panel-table")!;
    expect(tablePanel.hasAttribute("data-active")).toBe(false);

    const pivotPanel = shadow.getElementById("panel-pivot")!;
    expect(pivotPanel.hasAttribute("data-active")).toBe(true);
  });

  it("clicking tab button emits tab-change event", async () => {
    const el = createElement();
    const handler = vi.fn();
    el.addEventListener("tab-change", handler);
    
    const pivotBtn = el.shadowRoot!.querySelector(
      '[data-tab="pivot"]',
    ) as HTMLButtonElement;
    expect(pivotBtn).not.toBeNull();
    
    // Dispatch a click event manually (happy-dom sometimes doesn't
    // propagate .click() into shadow DOM event listeners)
    pivotBtn.dispatchEvent(new Event("click", { bubbles: true }));

    expect(handler).toHaveBeenCalledOnce();
    const detail = (handler.mock.calls[0][0] as CustomEvent<TabChangeDetail>)
      .detail;
    expect(detail.tab).toBe("pivot");
  });

  it("clicking same tab does not emit", () => {
    const el = createElement();
    const handler = vi.fn();
    el.addEventListener("tab-change", handler);

    // Table is already selected
    const tableBtn = el.shadowRoot!.querySelector(
      '[data-tab="table"]',
    ) as HTMLButtonElement;
    tableBtn.dispatchEvent(new Event("click", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("pivot tab is disabled when definition lacks pivot config", () => {
    const el = createElement();
    el.definition = makeDefinition(); // no pivot config

    const pivotBtn = el.shadowRoot!.querySelector(
      '[data-tab="pivot"]',
    ) as HTMLButtonElement;
    expect(pivotBtn.disabled).toBe(true);
  });

  it("pivot tab is enabled when definition has pivot config", () => {
    const el = createElement();
    el.definition = makeDefinition({
      rowGroupCols: [{ id: "cat", displayName: "Category" }],
      valueCols: [
        { id: "amount", displayName: "Amount", aggFunc: AggFunc.Sum },
      ],
    });

    const pivotBtn = el.shadowRoot!.querySelector(
      '[data-tab="pivot"]',
    ) as HTMLButtonElement;
    expect(pivotBtn.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Grid initialization (lazy, via mocked createGrid)
// ---------------------------------------------------------------------------

describe("<sj-data-grid> grid initialization", () => {
  it("creates table grid when dataset and columns are available", async () => {
    const { factory, api } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    // Wait for getColumns promise
    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce();
    });

    const callArgs = factory.mock.calls[0];
    expect(callArgs[1].rowModelType).toBe("serverSide");
    expect(callArgs[1].columnDefs).toHaveLength(3);
  });

  it("emits grid-ready with api and tab", async () => {
    const { factory } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const handler = vi.fn();
    const client = mockClient();
    const el = createElement();
    el.addEventListener("grid-ready", handler);
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
    });

    const detail = (handler.mock.calls[0][0] as CustomEvent<GridReadyDetail>)
      .detail;
    expect(detail.tab).toBe("table");
    expect(detail.api).toBeDefined();
  });

  it("does not create grid without createGrid factory", async () => {
    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await new Promise((r) => setTimeout(r, 20));
    // No factory — grid should not initialize, placeholder stays
    const ph = el.shadowRoot!.getElementById("placeholder-table")!;
    expect(ph.style.display).not.toBe("none");
  });

  it("does not create grid without client", () => {
    const { factory } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const el = createElement();
    el.datasetKey = "orders";

    expect(factory).not.toHaveBeenCalled();
  });

  it("does not create pivot grid unless pivot tab is activated", async () => {
    const { factory } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition({
      rowGroupCols: [{ id: "cat", displayName: "Category" }],
      valueCols: [
        { id: "amount", displayName: "Amount", aggFunc: AggFunc.Sum },
      ],
    });
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce(); // table only
    });

    // Now switch to pivot tab
    el.activeTab = "pivot";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledTimes(2); // table + pivot
    });

    const pivotCall = factory.mock.calls[1];
    expect(pivotCall[1].pivotMode).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Definition changes
// ---------------------------------------------------------------------------

describe("<sj-data-grid> definition changes", () => {
  it("refreshes table grid on definition change", async () => {
    const { factory, api } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce();
    });

    // Change definition
    el.definition = makeDefinition({
      selectedColumns: ["order_id"],
    });

    expect(api.updateGridOptions).toHaveBeenCalledWith(
      expect.objectContaining({ columnDefs: expect.any(Array) }),
    );
    expect(api.refreshServerSide).toHaveBeenCalledWith({ purge: true });
  });

  it("destroys grids when definition set to null", async () => {
    const { factory, api } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce();
    });

    el.definition = null;
    expect(api.destroy).toHaveBeenCalled();
  });

  it("resets when dataset key changes via definition", async () => {
    const { factory, api } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce();
    });

    // Change to different dataset via definition
    el.definition = makeDefinition({ datasetKey: "products" });

    expect(api.destroy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SSRM datasource
// ---------------------------------------------------------------------------

describe("<sj-data-grid> SSRM datasource", () => {
  it("table datasource calls client.queryTable", async () => {
    const { factory } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce();
    });

    // Extract the datasource and call getRows
    const gridOptions = factory.mock.calls[0][1];
    const datasource = gridOptions.serverSideDatasource;
    const successFn = vi.fn();
    const failFn = vi.fn();

    datasource.getRows({
      request: {
        startRow: 0,
        endRow: 50,
        rowGroupCols: [],
        groupKeys: [],
        valueCols: [],
        sortModel: [],
      },
      success: successFn,
      fail: failFn,
    });

    await vi.waitFor(() => {
      expect(client.queryTable).toHaveBeenCalledOnce();
    });

    expect(successFn).toHaveBeenCalledWith({
      rowData: [],
      rowCount: 0,
    });
    expect(failFn).not.toHaveBeenCalled();
  });

  it("table datasource calls fail on error", async () => {
    const { factory } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    (client.queryTable as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network"),
    );
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce();
    });

    const gridOptions = factory.mock.calls[0][1];
    const datasource = gridOptions.serverSideDatasource;
    const failFn = vi.fn();

    datasource.getRows({
      request: {
        startRow: 0,
        endRow: 50,
        rowGroupCols: [],
        groupKeys: [],
        valueCols: [],
        sortModel: [],
      },
      success: vi.fn(),
      fail: failFn,
    });

    await vi.waitFor(() => {
      expect(failFn).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe("<sj-data-grid> cleanup", () => {
  it("destroys grids on disconnectedCallback", async () => {
    const { factory, api } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce();
    });

    el.remove();
    expect(api.destroy).toHaveBeenCalled();
  });

  it("changing datasetKey destroys existing grids", async () => {
    const { factory, api } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const client = mockClient();
    const el = createElement();
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(factory).toHaveBeenCalledOnce();
    });

    el.datasetKey = "products";
    expect(api.destroy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Callback props
// ---------------------------------------------------------------------------

describe("<sj-data-grid> callback props", () => {
  it("invokes onTabChange callback", () => {
    const el = createElement();
    const callback = vi.fn();
    el.onTabChange = callback;

    const pivotBtn = el.shadowRoot!.querySelector(
      '[data-tab="pivot"]',
    ) as HTMLButtonElement;
    pivotBtn.dispatchEvent(new Event("click", { bubbles: true }));

    expect(callback).toHaveBeenCalledWith({ tab: "pivot" });
  });

  it("invokes onGridReady callback", async () => {
    const { factory } = mockCreateGrid();
    SanjayaDataGrid.createGrid = factory;

    const callback = vi.fn();
    const client = mockClient();
    const el = createElement();
    el.onGridReady = callback;
    el.client = client;
    el.definition = makeDefinition();
    el.datasetKey = "orders";

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledOnce();
    });

    expect(callback.mock.calls[0][0].tab).toBe("table");
  });
});

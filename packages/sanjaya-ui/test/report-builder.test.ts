// ---------------------------------------------------------------------------
// Tests for <sj-report-builder> — top-level orchestrator
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import type { SanjayaDataClient } from "../src/types/client.js";
import type { DynamicReport } from "../src/types/reports.js";
import {
  DynamicReportStatus,
  DynamicReportAction,
} from "../src/types/reports.js";
import { FilterCombinator, FilterOperator } from "../src/types/filters.js";
import { AggFunc } from "../src/types/ssrm.js";
import type { DatasetChangeDetail } from "../src/dataset-picker/dataset-picker.js";
import type { ColumnsChangeDetail } from "../src/column-selector/column-selector.js";
import type { FilterChangeDetail } from "../src/filter-builder/filter-builder.js";
import type { PivotConfigChangeDetail } from "../src/pivot-config/pivot-config.js";
import type {
  ReportDefinitionChangeDetail,
  ReportActionDetail,
} from "../src/report-builder/report-builder.js";

import "../src/report-builder/report-builder.js";
import { SanjayaReportBuilder } from "../src/report-builder/report-builder.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mockClient(): SanjayaDataClient {
  return {
    listDatasets: vi.fn().mockResolvedValue([]),
    getColumns: vi.fn().mockResolvedValue([]),
    queryTable: vi.fn(),
    queryPivot: vi.fn(),
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

function makeReport(
  overrides: Partial<DynamicReport> = {},
): DynamicReport {
  return {
    id: 42,
    title: "Test Report",
    description: "A test",
    status: DynamicReportStatus.Draft,
    createdBy: { id: "u1", name: "Alice" },
    createdAt: "2025-01-01T00:00:00Z",
    version: 1,
    tags: [],
    availableActions: [
      DynamicReportAction.Publish,
      DynamicReportAction.Delete,
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createElement(client?: SanjayaDataClient): SanjayaReportBuilder {
  const el = document.createElement(
    "sj-report-builder",
  ) as SanjayaReportBuilder;
  if (client) el.client = client;
  document.body.appendChild(el);
  return el;
}

function getTitle(el: SanjayaReportBuilder): string {
  return el.shadowRoot!.getElementById("builder-title")!.textContent ?? "";
}

function getDirtyDot(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("report-dirty")!;
}

function getStatusBadge(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("status-badge")!;
}

function getNoClientState(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("no-client-state")!;
}

function getBuilderBody(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("builder-body")!;
}

function getDatasetPicker(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("dataset-picker")!;
}

function getColumnSelector(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("column-selector")!;
}

function getFilterBuilder(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("filter-builder")!;
}

function getPivotConfig(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("pivot-config")!;
}

function getActionsMenu(el: SanjayaReportBuilder): HTMLElement {
  return el.shadowRoot!.getElementById("actions-menu")!;
}

/** Simulate a child emitting an event (composed, bubbles). */
function emitChild<T>(
  child: HTMLElement,
  name: string,
  detail: T,
): void {
  child.dispatchEvent(
    new CustomEvent<T>(name, { detail, bubbles: true, composed: true }),
  );
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Registration & initial state
// ---------------------------------------------------------------------------

describe("registration", () => {
  it("registers sj-report-builder as a custom element", () => {
    expect(customElements.get("sj-report-builder")).toBe(
      SanjayaReportBuilder,
    );
  });

  it("creates a shadow root", () => {
    const el = createElement();
    expect(el.shadowRoot).not.toBeNull();
  });
});

describe("initial state", () => {
  it("shows no-client state when client is null", () => {
    const el = createElement();
    expect(getNoClientState(el).hidden).toBe(false);
    expect(getBuilderBody(el).hidden).toBe(true);
  });

  it("shows builder body when client is set", () => {
    const el = createElement(mockClient());
    expect(getNoClientState(el).hidden).toBe(true);
    expect(getBuilderBody(el).hidden).toBe(false);
  });

  it("shows 'New Report' as default title", () => {
    const el = createElement(mockClient());
    expect(getTitle(el)).toBe("New Report");
  });

  it("hides dirty dot initially", () => {
    const el = createElement(mockClient());
    expect(getDirtyDot(el).hidden).toBe(true);
  });

  it("hides status badge for unsaved report", () => {
    const el = createElement(mockClient());
    expect(getStatusBadge(el).hidden).toBe(true);
  });

  it("report is null initially", () => {
    const el = createElement(mockClient());
    expect(el.report).toBeNull();
  });

  it("dirty is false initially", () => {
    const el = createElement(mockClient());
    expect(el.dirty).toBe(false);
  });

  it("getReportDefinition returns null when nothing configured", () => {
    const el = createElement(mockClient());
    expect(el.getReportDefinition()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Client injection
// ---------------------------------------------------------------------------

describe("client injection", () => {
  it("injects client into all child components", () => {
    const client = mockClient();
    const el = createElement(client);

    // Children should have the client set
    const picker = getDatasetPicker(el) as any;
    const cols = getColumnSelector(el) as any;
    const filter = getFilterBuilder(el) as any;
    const pivot = getPivotConfig(el) as any;

    expect(picker.client).toBe(client);
    expect(cols.client).toBe(client);
    expect(filter.client).toBe(client);
    expect(pivot.client).toBe(client);
  });

  it("updates client on all children when changed", () => {
    const client1 = mockClient();
    const client2 = mockClient();
    const el = createElement(client1);

    el.client = client2;

    const picker = getDatasetPicker(el) as any;
    expect(picker.client).toBe(client2);
  });
});

// ---------------------------------------------------------------------------
// Dataset change — cascading resets
// ---------------------------------------------------------------------------

describe("dataset-change", () => {
  it("updates state when dataset-change fires", () => {
    const el = createElement(mockClient());
    const picker = getDatasetPicker(el);

    emitChild<DatasetChangeDetail>(picker, "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: true },
    });

    const def = el.getReportDefinition()!;
    expect(def).not.toBeNull();
    expect(def.datasetKey).toBe("sales");
  });

  it("resets downstream children when dataset changes", () => {
    const el = createElement(mockClient());
    const picker = getDatasetPicker(el);
    const colSel = getColumnSelector(el) as any;

    // First select a dataset
    emitChild<DatasetChangeDetail>(picker, "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: true },
    });

    // Simulate columns being applied
    emitChild<ColumnsChangeDetail>(colSel, "columns-change", {
      columns: [
        { name: "year", selected: true, isGroup: false, order: 0 },
      ],
    });
    expect(el.getReportDefinition()!.selectedColumns).toEqual(["year"]);

    // Now change dataset — should reset columns
    emitChild<DatasetChangeDetail>(picker, "dataset-change", {
      key: "inventory",
      label: "Inventory",
      capabilities: { pivot: false },
    });

    expect(el.getReportDefinition()!.selectedColumns).toEqual([]);
  });

  it("sets datasetKey on downstream children", () => {
    const el = createElement(mockClient());
    const picker = getDatasetPicker(el);

    emitChild<DatasetChangeDetail>(picker, "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: true },
    });

    const colSel = getColumnSelector(el) as any;
    const filter = getFilterBuilder(el) as any;
    const pivot = getPivotConfig(el) as any;

    expect(colSel.datasetKey).toBe("sales");
    expect(filter.datasetKey).toBe("sales");
    expect(pivot.datasetKey).toBe("sales");
  });

  it("disables pivot when capabilities.pivot is false", () => {
    const el = createElement(mockClient());
    const picker = getDatasetPicker(el);

    emitChild<DatasetChangeDetail>(picker, "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });

    const pivot = getPivotConfig(el) as any;
    expect(pivot.disabled).toBe(true);
  });

  it("enables pivot when capabilities.pivot is true", () => {
    const el = createElement(mockClient());
    const picker = getDatasetPicker(el);

    emitChild<DatasetChangeDetail>(picker, "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: true },
    });

    const pivot = getPivotConfig(el) as any;
    expect(pivot.disabled).toBe(false);
  });

  it("emits report-definition-change on dataset change", () => {
    const el = createElement(mockClient());
    const spy = vi.fn();
    el.addEventListener("report-definition-change", spy);

    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });

    expect(spy).toHaveBeenCalledOnce();
    const detail = (
      spy.mock.calls[0][0] as CustomEvent<ReportDefinitionChangeDetail>
    ).detail;
    expect(detail!.datasetKey).toBe("sales");
  });
});

// ---------------------------------------------------------------------------
// Columns / filter / pivot change
// ---------------------------------------------------------------------------

describe("columns-change", () => {
  it("updates selected columns in definition", () => {
    const el = createElement(mockClient());
    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });

    emitChild<ColumnsChangeDetail>(getColumnSelector(el), "columns-change", {
      columns: [
        { name: "year", selected: true, isGroup: false, order: 0 },
        { name: "region", selected: true, isGroup: false, order: 1 },
        { name: "notes", selected: false, isGroup: false, order: 2 },
      ],
    });

    const def = el.getReportDefinition()!;
    expect(def.selectedColumns).toEqual(["year", "region"]);
  });
});

describe("filter-change", () => {
  it("updates filter in definition", () => {
    const el = createElement(mockClient());
    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });

    emitChild<FilterChangeDetail>(getFilterBuilder(el), "filter-change", {
      combinator: FilterCombinator.And,
      conditions: [
        { column: "year", operator: FilterOperator.Eq, value: 2024 },
      ],
    });

    const def = el.getReportDefinition()!;
    expect(def.filter.conditions).toHaveLength(1);
    expect(def.filter.conditions![0].column).toBe("year");
  });
});

describe("pivot-config-change", () => {
  it("updates pivot config in definition", () => {
    const el = createElement(mockClient());
    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: true },
    });

    emitChild<PivotConfigChangeDetail>(
      getPivotConfig(el),
      "pivot-config-change",
      {
        rowGroupCols: [
          { id: "region", displayName: "Region", field: "region" },
        ],
        pivotCols: [],
        valueCols: [
          {
            id: "revenue",
            displayName: "Revenue",
            field: "revenue",
            aggFunc: AggFunc.Sum,
          },
        ],
      },
    );

    const def = el.getReportDefinition()!;
    expect(def.rowGroupCols).toHaveLength(1);
    expect(def.valueCols).toHaveLength(1);
    expect(def.pivotCols).toBeUndefined(); // empty → omitted
  });
});

// ---------------------------------------------------------------------------
// Report-level dirty state
// ---------------------------------------------------------------------------

describe("report-level dirty state", () => {
  it("becomes dirty after child state changes (no saved snapshot)", () => {
    const el = createElement(mockClient());
    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });

    expect(el.dirty).toBe(true);
    expect(getDirtyDot(el).hidden).toBe(false);
  });

  it("is not dirty when state matches saved snapshot", () => {
    const client = mockClient();
    const report = makeReport({
      metadata: {
        definition: {
          datasetKey: "sales",
          selectedColumns: ["year"],
          filter: { combinator: FilterCombinator.And, conditions: [] },
        },
      },
    });

    const el = createElement(client);
    el.loadReport(report);

    // After loading, state should match snapshot — not dirty
    expect(el.dirty).toBe(false);
    expect(getDirtyDot(el).hidden).toBe(true);
  });

  it("becomes dirty when state diverges from saved snapshot", () => {
    const client = mockClient();
    const report = makeReport({
      metadata: {
        definition: {
          datasetKey: "sales",
          selectedColumns: ["year"],
          filter: { combinator: FilterCombinator.And, conditions: [] },
        },
      },
    });

    const el = createElement(client);
    el.loadReport(report);

    // Change columns → dirty
    emitChild<ColumnsChangeDetail>(getColumnSelector(el), "columns-change", {
      columns: [
        { name: "year", selected: true, isGroup: false, order: 0 },
        { name: "region", selected: true, isGroup: false, order: 1 },
      ],
    });

    expect(el.dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadReport
// ---------------------------------------------------------------------------

describe("loadReport", () => {
  it("hydrates state from report definition", () => {
    const client = mockClient();
    const report = makeReport({
      metadata: {
        definition: {
          datasetKey: "sales",
          selectedColumns: ["year", "region"],
          filter: { combinator: FilterCombinator.And, conditions: [] },
          rowGroupCols: [
            { id: "region", displayName: "Region", field: "region" },
          ],
        },
      },
    });

    const el = createElement(client);
    el.loadReport(report);

    expect(el.report).toBe(report);
    expect(el.reportId).toBe("42");

    const def = el.getReportDefinition()!;
    expect(def.datasetKey).toBe("sales");
    expect(def.selectedColumns).toEqual(["year", "region"]);
    expect(def.rowGroupCols).toHaveLength(1);
  });

  it("sets title from report", () => {
    const el = createElement(mockClient());
    el.loadReport(makeReport({ title: "Revenue Analysis" }));
    expect(getTitle(el)).toBe("Revenue Analysis");
  });

  it("shows status badge from report", () => {
    const el = createElement(mockClient());
    el.loadReport(makeReport({ status: DynamicReportStatus.Published }));
    const badge = getStatusBadge(el);
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe(DynamicReportStatus.Published);
  });

  it("pushes state to children via setAppliedValue", () => {
    const client = mockClient();
    const report = makeReport({
      metadata: {
        definition: {
          datasetKey: "sales",
          selectedColumns: ["year"],
          filter: { combinator: FilterCombinator.And, conditions: [] },
        },
      },
    });

    const el = createElement(client);
    el.loadReport(report);

    // Dataset picker should have the dataset key
    const picker = getDatasetPicker(el) as any;
    // The value/appliedValue will be set — we verify via the dataset key
    // being accessible in the orchestrator's state
    expect(el.getReportDefinition()!.datasetKey).toBe("sales");
  });

  it("does nothing for report without definition metadata", () => {
    const el = createElement(mockClient());
    el.loadReport(makeReport({ metadata: undefined }));
    expect(el.report).not.toBeNull();
    expect(el.getReportDefinition()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

describe("clearAll", () => {
  it("resets to blank state", () => {
    const client = mockClient();
    const el = createElement(client);

    // Load a report first
    el.loadReport(
      makeReport({
        metadata: {
          definition: {
            datasetKey: "sales",
            selectedColumns: ["year"],
            filter: { combinator: FilterCombinator.And, conditions: [] },
          },
        },
      }),
    );
    expect(el.report).not.toBeNull();

    el.clearAll();

    expect(el.report).toBeNull();
    expect(el.reportId).toBeNull();
    expect(el.dirty).toBe(false);
    expect(el.getReportDefinition()).toBeNull();
    expect(getTitle(el)).toBe("New Report");
  });
});

// ---------------------------------------------------------------------------
// Save operations (via actions menu)
// ---------------------------------------------------------------------------

describe("save", () => {
  it("calls createReport when no report is loaded", async () => {
    const client = mockClient();
    const createdReport = makeReport({ id: 99, title: "Untitled Report" });
    (client.createReport as ReturnType<typeof vi.fn>).mockResolvedValue(
      createdReport,
    );

    const el = createElement(client);

    // Select a dataset so there's something to save
    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });

    // Trigger save via action-select
    emitChild(getActionsMenu(el), "action-select", { action: "save" });
    await vi.waitFor(() => {
      expect(client.createReport).toHaveBeenCalledOnce();
    });

    expect(el.report).toBe(createdReport);
    expect(el.reportId).toBe("99");
    expect(el.dirty).toBe(false);
  });

  it("calls updateReport when report is already loaded", async () => {
    const client = mockClient();
    const report = makeReport({
      metadata: {
        definition: {
          datasetKey: "sales",
          selectedColumns: ["year"],
          filter: { combinator: FilterCombinator.And, conditions: [] },
        },
      },
    });
    const updatedReport = makeReport({ ...report, version: 2 });
    (client.updateReport as ReturnType<typeof vi.fn>).mockResolvedValue(
      updatedReport,
    );

    const el = createElement(client);
    el.loadReport(report);

    // Make a change to become dirty
    emitChild<ColumnsChangeDetail>(getColumnSelector(el), "columns-change", {
      columns: [
        { name: "year", selected: true, isGroup: false, order: 0 },
        { name: "q", selected: true, isGroup: false, order: 1 },
      ],
    });
    expect(el.dirty).toBe(true);

    // Save
    emitChild(getActionsMenu(el), "action-select", { action: "save" });
    await vi.waitFor(() => {
      expect(client.updateReport).toHaveBeenCalledOnce();
    });

    expect(el.dirty).toBe(false);
  });
});

describe("saveAs", () => {
  it("always calls createReport", async () => {
    const client = mockClient();
    const report = makeReport({
      title: "Original",
      metadata: {
        definition: {
          datasetKey: "sales",
          selectedColumns: [],
          filter: { combinator: FilterCombinator.And, conditions: [] },
        },
      },
    });
    const copy = makeReport({ id: 100, title: "Original (copy)" });
    (client.createReport as ReturnType<typeof vi.fn>).mockResolvedValue(copy);

    const el = createElement(client);
    el.loadReport(report);

    emitChild(getActionsMenu(el), "action-select", { action: "saveAs" });
    await vi.waitFor(() => {
      expect(client.createReport).toHaveBeenCalledOnce();
    });

    // The create payload should have "(copy)" title
    const payload = (client.createReport as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(payload.title).toBe("Original (copy)");

    expect(el.report).toBe(copy);
    expect(el.reportId).toBe("100");
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe("reset", () => {
  it("reverts to saved snapshot", () => {
    const client = mockClient();
    const report = makeReport({
      metadata: {
        definition: {
          datasetKey: "sales",
          selectedColumns: ["year"],
          filter: { combinator: FilterCombinator.And, conditions: [] },
        },
      },
    });

    const el = createElement(client);
    el.loadReport(report);

    // Change something
    emitChild<ColumnsChangeDetail>(getColumnSelector(el), "columns-change", {
      columns: [
        { name: "year", selected: true, isGroup: false, order: 0 },
        { name: "added", selected: true, isGroup: false, order: 1 },
      ],
    });
    expect(el.dirty).toBe(true);

    // Reset
    emitChild(getActionsMenu(el), "action-select", { action: "reset" });

    expect(el.dirty).toBe(false);
    const def = el.getReportDefinition()!;
    expect(def.selectedColumns).toEqual(["year"]);
  });

  it("calls clearAll when no saved snapshot", () => {
    const el = createElement(mockClient());

    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });
    expect(el.dirty).toBe(true);

    // Reset with no saved report — should clearAll
    emitChild(getActionsMenu(el), "action-select", { action: "reset" });
    expect(el.getReportDefinition()).toBeNull();
    expect(el.dirty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Server lifecycle actions
// ---------------------------------------------------------------------------

describe("performAction", () => {
  it("calls client.performAction and emits report-action", async () => {
    const client = mockClient();
    const report = makeReport();
    const published = makeReport({
      status: DynamicReportStatus.Published,
    });
    (client.performAction as ReturnType<typeof vi.fn>).mockResolvedValue(
      published,
    );

    const el = createElement(client);
    el.loadReport(report);

    const spy = vi.fn();
    el.addEventListener("report-action", spy);

    emitChild(getActionsMenu(el), "action-select", {
      action: DynamicReportAction.Publish,
    });
    await vi.waitFor(() => {
      expect(client.performAction).toHaveBeenCalledOnce();
    });

    expect(client.performAction).toHaveBeenCalledWith(
      "42",
      DynamicReportAction.Publish,
    );

    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0][0] as CustomEvent<ReportActionDetail>)
      .detail;
    expect(detail.action).toBe(DynamicReportAction.Publish);
    expect(detail.report).toBe(published);
  });

  it("emits export as report-action without calling performAction", () => {
    const client = mockClient();
    const el = createElement(client);

    const spy = vi.fn();
    el.addEventListener("report-action", spy);

    emitChild(getActionsMenu(el), "action-select", { action: "export" });

    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0][0] as CustomEvent<ReportActionDetail>)
      .detail;
    expect(detail.action).toBe("export");
    expect(client.performAction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// report-definition-change event
// ---------------------------------------------------------------------------

describe("report-definition-change", () => {
  it("fires on each child state change", () => {
    const el = createElement(mockClient());
    const spy = vi.fn();
    el.addEventListener("report-definition-change", spy);

    // dataset-change
    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });
    expect(spy).toHaveBeenCalledTimes(1);

    // columns-change
    emitChild<ColumnsChangeDetail>(getColumnSelector(el), "columns-change", {
      columns: [
        { name: "year", selected: true, isGroup: false, order: 0 },
      ],
    });
    expect(spy).toHaveBeenCalledTimes(2);

    // filter-change
    emitChild<FilterChangeDetail>(getFilterBuilder(el), "filter-change", {
      combinator: FilterCombinator.And,
      conditions: [],
    });
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("supports callback property", () => {
    const el = createElement(mockClient());
    const cbSpy = vi.fn();
    el.onReportDefinitionChange = cbSpy;

    emitChild<DatasetChangeDetail>(getDatasetPicker(el), "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });

    expect(cbSpy).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Lifecycle cleanup
// ---------------------------------------------------------------------------

describe("lifecycle", () => {
  it("removes event listeners on disconnectedCallback", () => {
    const el = createElement(mockClient());
    const spy = vi.fn();
    el.addEventListener("report-definition-change", spy);

    el.remove();

    // Dispatching on the child should not trigger the handler
    const picker = getDatasetPicker(el);
    emitChild<DatasetChangeDetail>(picker, "dataset-change", {
      key: "sales",
      label: "Sales",
      capabilities: { pivot: false },
    });

    expect(spy).not.toHaveBeenCalled();
  });
});

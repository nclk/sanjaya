// ---------------------------------------------------------------------------
// Tests for <sj-pivot-config> — orchestrator component
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import type { SanjayaDataClient } from "../src/types/client";
import type { ColumnMeta } from "../src/types/columns";
import { ColumnType } from "../src/types/columns";
import { AggFunc } from "../src/types/ssrm";
import type { ColumnVO } from "../src/types/ssrm";
import { FilterOperator } from "../src/types/filters";
import type { PivotConfig } from "../src/pivot-config/helpers";
import { emptyPivotConfig } from "../src/pivot-config/helpers";
import type { PivotConfigChangeDetail } from "../src/pivot-config/pivot-config";
import type {
  ZoneAddDetail,
  ZoneRemoveDetail,
  ZoneReorderDetail,
  ZoneAggChangeDetail,
} from "../src/pivot-config/zone-panel/zone-panel";

import "../src/pivot-config/pivot-config.js";
import { SanjayaPivotConfig } from "../src/pivot-config/pivot-config";
import { SanjayaPivotZone } from "../src/pivot-config/zone-panel/zone-panel";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const dimCol = (name: string, label?: string): ColumnMeta => ({
  name,
  label: label ?? name,
  type: ColumnType.String,
  operators: [FilterOperator.Eq],
  nullable: false,
  pivot: { role: "dimension" },
});

const measCol = (
  name: string,
  label?: string,
  allowedAggs?: Array<{ agg: AggFunc; label: string }>,
): ColumnMeta => ({
  name,
  label: label ?? name,
  type: ColumnType.Number,
  operators: [FilterOperator.Eq],
  nullable: false,
  pivot: {
    role: "measure",
    allowedAggs: allowedAggs ?? [
      { agg: AggFunc.Sum, label: "Sum" },
      { agg: AggFunc.Avg, label: "Average" },
    ],
  },
});

const COLUMNS: ColumnMeta[] = [
  dimCol("region", "Region"),
  dimCol("year", "Year"),
  measCol("revenue", "Revenue"),
  measCol("cost", "Cost"),
];

function mockClient(columns: ColumnMeta[] = COLUMNS): SanjayaDataClient {
  return {
    listDatasets: vi.fn(),
    getColumns: vi.fn().mockResolvedValue(columns),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createElement(
  client?: SanjayaDataClient,
  datasetKey = "sales",
): Promise<SanjayaPivotConfig> {
  const el = document.createElement("sj-pivot-config") as SanjayaPivotConfig;
  if (client) el.client = client;
  if (datasetKey) el.datasetKey = datasetKey;
  document.body.appendChild(el);
  // Wait for async column loading
  await vi.waitFor(() => {});
  return el;
}

function getZone(
  el: SanjayaPivotConfig,
  id: "zone-rows" | "zone-columns" | "zone-values",
): SanjayaPivotZone {
  return el.shadowRoot!.getElementById(id) as unknown as SanjayaPivotZone;
}

function getApplyBtn(el: SanjayaPivotConfig): HTMLButtonElement {
  return el.shadowRoot!.getElementById("btn-apply") as HTMLButtonElement;
}

function getUndoBtn(el: SanjayaPivotConfig): HTMLButtonElement {
  return el.shadowRoot!.getElementById("btn-undo") as HTMLButtonElement;
}

function getDirtyDot(el: SanjayaPivotConfig): HTMLElement {
  return el.shadowRoot!.getElementById("dirty-indicator")!;
}

function getZonesEl(el: SanjayaPivotConfig): HTMLElement {
  return el.shadowRoot!.getElementById("zones")!;
}

function getEmptyState(el: SanjayaPivotConfig): HTMLElement {
  return el.shadowRoot!.getElementById("empty-state")!;
}

function getDisabledState(el: SanjayaPivotConfig): HTMLElement {
  return el.shadowRoot!.getElementById("disabled-state")!;
}

/**
 * Fire a zone intent event on one of the child zone panels.
 */
function fireZoneEvent<T>(
  zone: SanjayaPivotZone,
  eventName: string,
  detail: T,
): void {
  zone.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("registration", () => {
  it("is registered as sj-pivot-config", () => {
    expect(customElements.get("sj-pivot-config")).toBe(SanjayaPivotConfig);
  });

  it("creates an instance via document.createElement", () => {
    const el = document.createElement("sj-pivot-config");
    expect(el).toBeInstanceOf(SanjayaPivotConfig);
  });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("initial state", () => {
  it("has empty value before loading", () => {
    const el = document.createElement("sj-pivot-config") as SanjayaPivotConfig;
    expect(el.value).toEqual(emptyPivotConfig());
  });

  it("has disabled=false by default", () => {
    const el = document.createElement("sj-pivot-config") as SanjayaPivotConfig;
    expect(el.disabled).toBe(false);
  });

  it("has null client and datasetKey by default", () => {
    const el = document.createElement("sj-pivot-config") as SanjayaPivotConfig;
    expect(el.client).toBeNull();
    expect(el.datasetKey).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Column loading
// ---------------------------------------------------------------------------

describe("column loading", () => {
  it("fetches columns when client and datasetKey are set", async () => {
    const client = mockClient();
    const el = await createElement(client);

    expect(client.getColumns).toHaveBeenCalledWith("sales");
  });

  it("populates zone panels with column metadata", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    const cols = getZone(el, "zone-columns");
    const vals = getZone(el, "zone-values");

    // Column metadata should be pushed to all zones
    expect(rows.columnMeta).toEqual(COLUMNS);
    expect(cols.columnMeta).toEqual(COLUMNS);
    expect(vals.columnMeta).toEqual(COLUMNS);
  });

  it("sets candidates for dimension zones", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    // Should show all dimensions as candidates (none placed yet)
    expect(rows.candidates.map((c) => c.name)).toEqual(["region", "year"]);
  });

  it("sets candidates for values zone", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const vals = getZone(el, "zone-values");
    expect(vals.candidates.map((c) => c.name)).toEqual(["revenue", "cost"]);
  });

  it("shows zones when columns are loaded", async () => {
    const client = mockClient();
    const el = await createElement(client);

    expect(getZonesEl(el).hidden).toBe(false);
    expect(getEmptyState(el).hidden).toBe(true);
    expect(getDisabledState(el).hidden).toBe(true);
  });

  it("shows empty state when no columns returned", async () => {
    const client = mockClient([]);
    const el = await createElement(client);

    expect(getZonesEl(el).hidden).toBe(true);
    expect(getEmptyState(el).hidden).toBe(false);
  });

  it("handles getColumns failure gracefully", async () => {
    const client = mockClient();
    (client.getColumns as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );
    const el = await createElement(client);

    // Should show empty state (no crash)
    expect(getZonesEl(el).hidden).toBe(true);
    expect(getEmptyState(el).hidden).toBe(false);
  });

  it("re-fetches columns when datasetKey changes", async () => {
    const client = mockClient();
    const el = await createElement(client);

    el.datasetKey = "inventory";
    await vi.waitFor(() => {});

    expect(client.getColumns).toHaveBeenCalledWith("inventory");
  });

  it("does not re-fetch when same datasetKey is set", async () => {
    const client = mockClient();
    const el = await createElement(client);

    (client.getColumns as ReturnType<typeof vi.fn>).mockClear();
    el.datasetKey = "sales"; // same value
    await vi.waitFor(() => {});

    expect(client.getColumns).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Zone event handling — add
// ---------------------------------------------------------------------------

describe("zone-add event", () => {
  it("adds a dimension to rows and updates zone items", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });

    expect(rows.items.map((c) => c.id)).toEqual(["region"]);
  });

  it("removes added dimension from candidates", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    const cols = getZone(el, "zone-columns");

    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });

    // region should no longer be a candidate for rows or columns
    expect(rows.candidates.map((c) => c.name)).toEqual(["year"]);
    expect(cols.candidates.map((c) => c.name)).toEqual(["year"]);
  });

  it("adds a measure to values with default aggFunc", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const vals = getZone(el, "zone-values");
    fireZoneEvent<ZoneAddDetail>(vals, "zone-add", {
      zone: "values",
      colId: "revenue",
    });

    expect(vals.items).toHaveLength(1);
    expect(vals.items[0].id).toBe("revenue");
    expect(vals.items[0].aggFunc).toBe(AggFunc.Sum);
  });

  it("enforces dimension exclusivity across rows and columns", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    const cols = getZone(el, "zone-columns");

    // Add region to rows first
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });
    expect(rows.items.map((c) => c.id)).toEqual(["region"]);

    // Now add region to columns — should remove from rows
    fireZoneEvent<ZoneAddDetail>(cols, "zone-add", {
      zone: "columns",
      colId: "region",
    });
    expect(cols.items.map((c) => c.id)).toEqual(["region"]);
    expect(rows.items).toHaveLength(0);
  });

  it("marks dirty after adding", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });

    expect(getApplyBtn(el).disabled).toBe(false);
    expect(getUndoBtn(el).disabled).toBe(false);
    expect(getDirtyDot(el).hidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Zone event handling — remove
// ---------------------------------------------------------------------------

describe("zone-remove event", () => {
  it("removes a column and returns it to candidates", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");

    // Add then remove
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });
    fireZoneEvent<ZoneRemoveDetail>(rows, "zone-remove", {
      zone: "rows",
      colId: "region",
    });

    expect(rows.items).toHaveLength(0);
    expect(rows.candidates.map((c) => c.name)).toContain("region");
  });
});

// ---------------------------------------------------------------------------
// Zone event handling — reorder
// ---------------------------------------------------------------------------

describe("zone-reorder event", () => {
  it("reorders items within a zone", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");

    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "year",
    });
    expect(rows.items.map((c) => c.id)).toEqual(["region", "year"]);

    fireZoneEvent<ZoneReorderDetail>(rows, "zone-reorder", {
      zone: "rows",
      fromIdx: 0,
      toIdx: 1,
    });
    expect(rows.items.map((c) => c.id)).toEqual(["year", "region"]);
  });
});

// ---------------------------------------------------------------------------
// Zone event handling — agg change
// ---------------------------------------------------------------------------

describe("zone-agg-change event", () => {
  it("updates aggFunc for a value column", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const vals = getZone(el, "zone-values");

    fireZoneEvent<ZoneAddDetail>(vals, "zone-add", {
      zone: "values",
      colId: "revenue",
    });

    fireZoneEvent<ZoneAggChangeDetail>(vals, "zone-agg-change", {
      zone: "values",
      colId: "revenue",
      aggFunc: AggFunc.Avg,
    });

    expect(vals.items[0].aggFunc).toBe(AggFunc.Avg);
  });
});

// ---------------------------------------------------------------------------
// Apply / Undo
// ---------------------------------------------------------------------------

describe("Apply / Undo", () => {
  it("Apply and Undo buttons are disabled when not dirty", async () => {
    const client = mockClient();
    const el = await createElement(client);

    expect(getApplyBtn(el).disabled).toBe(true);
    expect(getUndoBtn(el).disabled).toBe(true);
    expect(getDirtyDot(el).hidden).toBe(true);
  });

  it("Apply emits pivot-config-change and clears dirty", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });

    const handler = vi.fn();
    el.addEventListener("pivot-config-change", handler);

    getApplyBtn(el).click();

    expect(handler).toHaveBeenCalledOnce();
    const detail = (
      handler.mock.calls[0][0] as CustomEvent<PivotConfigChangeDetail>
    ).detail;
    expect(detail.rowGroupCols.map((c: ColumnVO) => c.id)).toEqual([
      "region",
    ]);

    // Should no longer be dirty
    expect(getApplyBtn(el).disabled).toBe(true);
    expect(getDirtyDot(el).hidden).toBe(true);
  });

  it("Apply updates the .value property", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "year",
    });

    getApplyBtn(el).click();

    expect(el.value.rowGroupCols.map((c) => c.id)).toEqual(["year"]);
  });

  it("Undo reverts to last applied config", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });

    // Undo without applying
    getUndoBtn(el).click();

    expect(rows.items).toHaveLength(0);
    expect(getApplyBtn(el).disabled).toBe(true);
    expect(getDirtyDot(el).hidden).toBe(true);
  });

  it("Undo after apply reverts to the applied state", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");

    // Add region, apply
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });
    getApplyBtn(el).click();

    // Add year (dirty again)
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "year",
    });
    expect(rows.items).toHaveLength(2);

    // Undo — should go back to region only
    getUndoBtn(el).click();
    expect(rows.items.map((c) => c.id)).toEqual(["region"]);
  });
});

// ---------------------------------------------------------------------------
// setAppliedValue
// ---------------------------------------------------------------------------

describe("setAppliedValue", () => {
  it("resets both applied and current state", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const config: PivotConfig = {
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
    };

    el.setAppliedValue(config);

    expect(el.value).toEqual(config);

    // Zone panels should reflect the config
    const rows = getZone(el, "zone-rows");
    const vals = getZone(el, "zone-values");
    expect(rows.items.map((c) => c.id)).toEqual(["region"]);
    expect(vals.items.map((c) => c.id)).toEqual(["revenue"]);

    // Should not be dirty
    expect(getApplyBtn(el).disabled).toBe(true);
  });

  it("does not emit an event", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const handler = vi.fn();
    el.addEventListener("pivot-config-change", handler);

    el.setAppliedValue({
      rowGroupCols: [
        { id: "region", displayName: "Region", field: "region" },
      ],
      pivotCols: [],
      valueCols: [],
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

describe("disabled state", () => {
  it("shows disabled overlay when disabled=true", async () => {
    const client = mockClient();
    const el = await createElement(client);

    el.disabled = true;

    expect(getDisabledState(el).hidden).toBe(false);
    expect(getZonesEl(el).hidden).toBe(true);
    expect(getEmptyState(el).hidden).toBe(true);
  });

  it("shows zones when disabled=false", async () => {
    const client = mockClient();
    const el = await createElement(client);

    el.disabled = true;
    el.disabled = false;

    expect(getDisabledState(el).hidden).toBe(true);
    expect(getZonesEl(el).hidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("lifecycle", () => {
  it("cleans up event listeners on disconnect", async () => {
    const client = mockClient();
    const el = await createElement(client);

    const rows = getZone(el, "zone-rows");

    document.body.removeChild(el);

    // Apply/Undo clicks should not trigger events after disconnect
    const handler = vi.fn();
    el.addEventListener("pivot-config-change", handler);

    // Simulate a zone-add that would normally make it dirty
    fireZoneEvent<ZoneAddDetail>(rows, "zone-add", {
      zone: "rows",
      colId: "region",
    });

    // Apply button click should not fire event (listener removed)
    getApplyBtn(el).click();
    expect(handler).not.toHaveBeenCalled();
  });

  it("child zones are configured with correct zone types", async () => {
    const client = mockClient();
    const el = await createElement(client);

    expect(getZone(el, "zone-rows").zone).toBe("rows");
    expect(getZone(el, "zone-columns").zone).toBe("columns");
    expect(getZone(el, "zone-values").zone).toBe("values");
  });
});

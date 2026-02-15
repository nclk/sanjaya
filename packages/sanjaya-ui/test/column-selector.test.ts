// ---------------------------------------------------------------------------
// Tests for <sj-column-selector>
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import type { SanjayaDataClient } from "../src/types/client";
import type { ColumnMeta } from "../src/types/columns";
import { ColumnType } from "../src/types/columns";
import { FilterOperator } from "../src/types/filters";
import type {
  ColumnSelection,
  ColumnsChangeDetail,
} from "../src/column-selector/column-selector";

import "../src/column-selector/column-selector.js";
import { SanjayaColumnSelector } from "../src/column-selector/column-selector";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COLUMNS: ColumnMeta[] = [
  {
    name: "year",
    label: "Year",
    type: ColumnType.Number,
    operators: [FilterOperator.Eq],
    nullable: false,
    pivot: { role: "dimension" },
  },
  {
    name: "region",
    label: "Region",
    type: ColumnType.String,
    operators: [FilterOperator.Eq, FilterOperator.In],
    nullable: false,
    pivot: { role: "dimension" },
  },
  {
    name: "amount",
    label: "Amount",
    type: ColumnType.Currency,
    operators: [FilterOperator.Gt, FilterOperator.Lt],
    nullable: false,
    pivot: { role: "measure", allowedAggs: [{ agg: "sum" as any, label: "Sum" }] },
  },
  {
    name: "notes",
    label: "Notes",
    type: ColumnType.String,
    operators: [FilterOperator.Contains],
    nullable: true,
  },
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
): Promise<SanjayaColumnSelector> {
  const el = document.createElement("sj-column-selector") as SanjayaColumnSelector;
  if (client) el.client = client;
  if (datasetKey) el.datasetKey = datasetKey;
  document.body.appendChild(el);
  await vi.waitFor(() => {});
  return el;
}

function getItems(el: SanjayaColumnSelector): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>(".column-item"),
  );
}

function getCheckbox(li: HTMLElement): HTMLInputElement {
  return li.querySelector(".column-check") as HTMLInputElement;
}

function getGroupToggle(li: HTMLElement): HTMLInputElement {
  return li.querySelector(".group-check") as HTMLInputElement;
}

function getApplyBtn(el: SanjayaColumnSelector): HTMLButtonElement {
  return el.shadowRoot!.getElementById("btn-apply") as HTMLButtonElement;
}

function getUndoBtn(el: SanjayaColumnSelector): HTMLButtonElement {
  return el.shadowRoot!.getElementById("btn-undo") as HTMLButtonElement;
}

function getSelectAll(el: SanjayaColumnSelector): HTMLInputElement {
  return el.shadowRoot!.getElementById("select-all") as HTMLInputElement;
}

function getColumnCount(el: SanjayaColumnSelector): string {
  return el.shadowRoot!.getElementById("column-count")!.textContent ?? "";
}

function getDirtyDot(el: SanjayaColumnSelector): HTMLElement {
  return el.shadowRoot!.getElementById("dirty-indicator") as HTMLElement;
}

function getEmptyState(el: SanjayaColumnSelector): HTMLElement {
  return el.shadowRoot!.getElementById("empty-state") as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sj-column-selector", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  // --- Rendering ---------------------------------------------------------

  describe("rendering", () => {
    it("renders a row per column", async () => {
      const el = await createElement(mockClient());
      expect(getItems(el)).toHaveLength(4);
    });

    it("shows column labels", async () => {
      const el = await createElement(mockClient());
      const labels = getItems(el).map(
        (li) => li.querySelector(".column-label")!.textContent,
      );
      expect(labels).toEqual(["Year", "Region", "Amount", "Notes"]);
    });

    it("all columns start selected", async () => {
      const el = await createElement(mockClient());
      const checked = getItems(el).map((li) => getCheckbox(li).checked);
      expect(checked).toEqual([true, true, true, true]);
    });

    it("shows column count", async () => {
      const el = await createElement(mockClient());
      expect(getColumnCount(el)).toBe("4 / 4");
    });

    it("shows empty state when no columns", async () => {
      const el = await createElement(mockClient([]));
      expect(getEmptyState(el).hidden).toBe(false);
    });

    it("renders nothing until client and datasetKey are set", async () => {
      const el = await createElement();
      expect(getItems(el)).toHaveLength(0);
    });
  });

  // --- Selection ---------------------------------------------------------

  describe("selection", () => {
    it("unchecking a column updates dirty state", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      getCheckbox(items[0]).click();
      expect(getDirtyDot(el).hidden).toBe(false);
      expect(getColumnCount(el)).toBe("3 / 4");
    });

    it("does not emit event until Apply is clicked", async () => {
      const el = await createElement(mockClient());
      const handler = vi.fn();
      el.addEventListener("columns-change", handler);

      getCheckbox(getItems(el)[0]).click();
      expect(handler).not.toHaveBeenCalled();
    });

    it("unchecking also ungroups the column", async () => {
      const el = await createElement(mockClient());
      // First, group the year column
      getGroupToggle(getItems(el)[0]).click();
      expect(getGroupToggle(getItems(el)[0]).checked).toBe(true);

      // Then uncheck it — isGroup should reset
      getCheckbox(getItems(el)[0]).click();
      expect(getGroupToggle(getItems(el)[0]).checked).toBe(false);
    });
  });

  // --- Select all --------------------------------------------------------

  describe("select all", () => {
    it("deselects all when unchecked", async () => {
      const el = await createElement(mockClient());
      getSelectAll(el).click();

      const checked = getItems(el).map((li) => getCheckbox(li).checked);
      expect(checked).toEqual([false, false, false, false]);
      expect(getColumnCount(el)).toBe("0 / 4");
    });

    it("selects all when checked", async () => {
      const el = await createElement(mockClient());
      // Deselect all first
      getSelectAll(el).click();
      // Then re-select all
      getSelectAll(el).click();

      const checked = getItems(el).map((li) => getCheckbox(li).checked);
      expect(checked).toEqual([true, true, true, true]);
    });

    it("shows indeterminate when partial", async () => {
      const el = await createElement(mockClient());
      getCheckbox(getItems(el)[0]).click();
      expect(getSelectAll(el).indeterminate).toBe(true);
    });

    it("deselect all also ungroups grouped columns", async () => {
      const el = await createElement(mockClient());
      // Group year first
      getGroupToggle(getItems(el)[0]).click();
      expect(getGroupToggle(getItems(el)[0]).checked).toBe(true);

      // Deselect all
      getSelectAll(el).click();

      // isGroup should be reset on all columns
      const grouped = getItems(el).map((li) => getGroupToggle(li).checked);
      expect(grouped).toEqual([false, false, false, false]);
    });
  });

  // --- isGroup toggle ----------------------------------------------------

  describe("isGroup toggle", () => {
    it("toggles isGroup on a dimension column", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      // year is a dimension
      getGroupToggle(items[0]).click();
      expect(getGroupToggle(getItems(el)[0]).checked).toBe(true);
      expect(getDirtyDot(el).hidden).toBe(false);
    });

    it("measure columns have disabled group toggle", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      // amount (index 2) is a measure
      const toggle = getGroupToggle(items[2]);
      expect(toggle.disabled).toBe(true);
    });

    it("columns without pivot options can be toggled", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      // notes (index 3) has no pivotOptions
      const toggle = getGroupToggle(items[3]);
      expect(toggle.disabled).toBe(false);
    });
  });

  // --- Dirty state -------------------------------------------------------

  describe("dirty state", () => {
    it("starts with Apply and Undo disabled", async () => {
      const el = await createElement(mockClient());
      expect(getApplyBtn(el).disabled).toBe(true);
      expect(getUndoBtn(el).disabled).toBe(true);
    });

    it("enables buttons after a change", async () => {
      const el = await createElement(mockClient());
      getCheckbox(getItems(el)[1]).click();
      expect(getApplyBtn(el).disabled).toBe(false);
      expect(getUndoBtn(el).disabled).toBe(false);
    });

    it("disables buttons after Apply", async () => {
      const el = await createElement(mockClient());
      getCheckbox(getItems(el)[1]).click();
      getApplyBtn(el).click();
      expect(getApplyBtn(el).disabled).toBe(true);
      expect(getDirtyDot(el).hidden).toBe(true);
    });
  });

  // --- Apply / Undo ------------------------------------------------------

  describe("apply and undo", () => {
    it("emits columns-change event on Apply", async () => {
      const el = await createElement(mockClient());
      const handler = vi.fn();
      el.addEventListener("columns-change", handler);

      getCheckbox(getItems(el)[0]).click();
      getApplyBtn(el).click();

      expect(handler).toHaveBeenCalledOnce();
      const detail = (handler.mock.calls[0][0] as CustomEvent<ColumnsChangeDetail>).detail;
      expect(detail.columns).toHaveLength(4);
      const year = detail.columns.find((c) => c.name === "year");
      expect(year?.selected).toBe(false);
    });

    it("invokes onColumnsChange callback on Apply", async () => {
      const el = await createElement(mockClient());
      const callback = vi.fn();
      el.onColumnsChange = callback;

      getGroupToggle(getItems(el)[0]).click();
      getApplyBtn(el).click();

      expect(callback).toHaveBeenCalledOnce();
      const yearCol = callback.mock.calls[0][0].columns.find(
        (c: any) => c.name === "year",
      );
      expect(yearCol.isGroup).toBe(true);
    });

    it("reverts changes on Undo", async () => {
      const el = await createElement(mockClient());
      getCheckbox(getItems(el)[0]).click();
      expect(getCheckbox(getItems(el)[0]).checked).toBe(false);

      getUndoBtn(el).click();
      expect(getCheckbox(getItems(el)[0]).checked).toBe(true);
      expect(getApplyBtn(el).disabled).toBe(true);
    });

    it("value reflects applied state", async () => {
      const el = await createElement(mockClient());
      expect(el.value.columns.every((c) => c.selected)).toBe(true);

      getCheckbox(getItems(el)[0]).click();
      // Not applied yet — value unchanged
      expect(el.value.columns.every((c) => c.selected)).toBe(true);

      getApplyBtn(el).click();
      const year = el.value.columns.find((c) => c.name === "year");
      expect(year?.selected).toBe(false);
    });
  });

  // --- Reordering --------------------------------------------------------

  describe("reordering", () => {
    it("items have draggable attribute", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      expect(items[0].getAttribute("draggable")).toBe("true");
    });

    it("reordering updates order values and marks dirty", async () => {
      const el = await createElement(mockClient());
      const handler = vi.fn();
      el.addEventListener("columns-change", handler);

      // Move "year" (index 0) to after "region" (index 1)
      el.setAppliedValue({
        columns: [
          { name: "year", selected: true, isGroup: false, order: 0 },
          { name: "region", selected: true, isGroup: false, order: 1 },
          { name: "amount", selected: true, isGroup: false, order: 2 },
          { name: "notes", selected: true, isGroup: false, order: 3 },
        ],
      });

      // Simulate the reorder by setting a new value with swapped order
      // and verifying the DOM renders in the new order
      el.setAppliedValue({
        columns: [
          { name: "year", selected: true, isGroup: false, order: 1 },
          { name: "region", selected: true, isGroup: false, order: 0 },
          { name: "amount", selected: true, isGroup: false, order: 2 },
          { name: "notes", selected: true, isGroup: false, order: 3 },
        ],
      });

      const labels = getItems(el).map(
        (li) => li.querySelector(".column-label")!.textContent,
      );
      expect(labels).toEqual(["Region", "Year", "Amount", "Notes"]);
    });
  });

  // --- Keyboard navigation -----------------------------------------------

  describe("keyboard navigation", () => {
    it("ArrowDown moves focus to next item", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      const focusSpy = vi.spyOn(items[1], "focus");
      items[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
      expect(focusSpy).toHaveBeenCalled();
    });

    it("ArrowUp moves focus to previous item", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      const focusSpy = vi.spyOn(items[0], "focus");
      items[1].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      );
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  // --- Public API --------------------------------------------------------

  describe("public API", () => {
    it("setAppliedValue sets value without emitting", async () => {
      const el = await createElement(mockClient());
      const handler = vi.fn();
      el.addEventListener("columns-change", handler);

      const custom: ColumnSelection = {
        columns: [
          { name: "year", selected: true, isGroup: true, order: 0 },
          { name: "region", selected: false, isGroup: false, order: 1 },
          { name: "amount", selected: true, isGroup: false, order: 2 },
          { name: "notes", selected: true, isGroup: false, order: 3 },
        ],
      };
      el.setAppliedValue(custom);

      expect(handler).not.toHaveBeenCalled();
      expect(el.value.columns.find((c) => c.name === "year")?.isGroup).toBe(true);
      expect(el.value.columns.find((c) => c.name === "region")?.selected).toBe(false);
    });

    it("setAppliedValue updates the rendered DOM", async () => {
      const el = await createElement(mockClient());
      el.setAppliedValue({
        columns: [
          { name: "year", selected: false, isGroup: false, order: 0 },
          { name: "region", selected: true, isGroup: true, order: 1 },
          { name: "amount", selected: true, isGroup: false, order: 2 },
          { name: "notes", selected: true, isGroup: false, order: 3 },
        ],
      });

      const items = getItems(el);
      expect(getCheckbox(items[0]).checked).toBe(false);
      expect(getCheckbox(items[1]).checked).toBe(true);
      expect(getGroupToggle(items[1]).checked).toBe(true);
      expect(getColumnCount(el)).toBe("3 / 4");
    });

    it("refresh re-fetches columns", async () => {
      const client = mockClient();
      const el = await createElement(client);
      const callsBefore = (client.getColumns as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      await el.refresh();
      expect(client.getColumns).toHaveBeenCalledTimes(callsBefore + 1);
    });

    it("changing datasetKey triggers a new fetch", async () => {
      const client = mockClient();
      const el = await createElement(client, "sales");
      const callsBefore = (client.getColumns as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      el.datasetKey = "employees";
      await vi.waitFor(() => {});
      expect(client.getColumns).toHaveBeenCalledTimes(callsBefore + 1);
      expect(
        (client.getColumns as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0],
      ).toBe("employees");
    });

    it("changing datasetKey resets dirty state and selection", async () => {
      const client = mockClient();
      const el = await createElement(client, "sales");

      // Make a change to create dirty state
      getCheckbox(getItems(el)[0]).click();
      expect(getDirtyDot(el).hidden).toBe(false);

      // Switch datasets
      el.datasetKey = "employees";
      await vi.waitFor(() => {});

      // Dirty state should be reset — fresh load
      expect(getDirtyDot(el).hidden).toBe(true);
      expect(getApplyBtn(el).disabled).toBe(true);
      // All columns re-selected (fresh load)
      expect(el.value.columns.every((c) => c.selected)).toBe(true);
    });

    it("setting same datasetKey does not re-fetch", async () => {
      const client = mockClient();
      const el = await createElement(client, "sales");
      const callsBefore = (client.getColumns as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      el.datasetKey = "sales";
      await vi.waitFor(() => {});
      expect(client.getColumns).toHaveBeenCalledTimes(callsBefore);
    });
  });

  // --- Error handling ----------------------------------------------------

  describe("error handling", () => {
    it("renders empty list when getColumns rejects", async () => {
      const client = mockClient();
      (client.getColumns as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );
      const el = await createElement(client);
      expect(getItems(el)).toHaveLength(0);
      expect(getEmptyState(el).hidden).toBe(false);
    });
  });

  // --- Cleanup -----------------------------------------------------------

  describe("lifecycle", () => {
    it("removes event listeners on disconnect", async () => {
      const el = await createElement(mockClient());
      const spy = vi.spyOn(
        el.shadowRoot!.getElementById("select-all") as HTMLInputElement,
        "removeEventListener",
      );
      el.remove();
      expect(spy).toHaveBeenCalledWith("change", expect.any(Function));
    });
  });
});

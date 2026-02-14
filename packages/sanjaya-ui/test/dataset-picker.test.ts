// ---------------------------------------------------------------------------
// Tests for <sj-dataset-picker>
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SanjayaDataClient } from "../src/types/client.js";
import type { DatasetSummary } from "../src/types/datasets.js";
import type { DatasetChangeDetail } from "../src/dataset-picker/dataset-picker.js";

// Import registers the custom element as a side-effect
import "../src/dataset-picker/dataset-picker.js";
import { SanjayaDatasetPicker } from "../src/dataset-picker/dataset-picker.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DATASETS: DatasetSummary[] = [
  {
    key: "sales",
    label: "Sales Data",
    description: "Quarterly sales figures",
    capabilities: { pivot: true },
  },
  {
    key: "employees",
    label: "Employee Roster",
    description: "HR employee directory",
    capabilities: { pivot: false },
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "",
    capabilities: { pivot: false },
  },
];

function mockClient(datasets: DatasetSummary[] = DATASETS): SanjayaDataClient {
  return {
    listDatasets: vi.fn().mockResolvedValue(datasets),
    getColumns: vi.fn(),
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

/** Create, attach, and wait for the element to render. */
async function createElement(
  client?: SanjayaDataClient,
): Promise<SanjayaDatasetPicker> {
  const el = document.createElement(
    "sj-dataset-picker",
  ) as SanjayaDatasetPicker;
  if (client) {
    el.client = client;
  }
  document.body.appendChild(el);
  // Let microtask (listDatasets promise) settle
  await vi.waitFor(() => {});
  return el;
}

function getItems(el: SanjayaDatasetPicker): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>(".dataset-item"),
  );
}

function getApplyBtn(el: SanjayaDatasetPicker): HTMLButtonElement {
  return el.shadowRoot!.getElementById("btn-apply") as HTMLButtonElement;
}

function getUndoBtn(el: SanjayaDatasetPicker): HTMLButtonElement {
  return el.shadowRoot!.getElementById("btn-undo") as HTMLButtonElement;
}

function getSearchInput(el: SanjayaDatasetPicker): HTMLInputElement {
  return el.shadowRoot!.getElementById("search") as HTMLInputElement;
}

function getDirtyDot(el: SanjayaDatasetPicker): HTMLElement {
  return el.shadowRoot!.getElementById("dirty-indicator") as HTMLElement;
}

function getEmptyState(el: SanjayaDatasetPicker): HTMLElement {
  return el.shadowRoot!.getElementById("empty-state") as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sj-dataset-picker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  // --- Rendering ---------------------------------------------------------

  describe("rendering", () => {
    it("renders a list item per dataset", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      expect(items).toHaveLength(3);
    });

    it("shows dataset labels", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      const labels = items.map(
        (li) => li.querySelector(".dataset-item-name")!.textContent,
      );
      expect(labels).toEqual(["Sales Data", "Employee Roster", "Inventory"]);
    });

    it("shows pivot badge only for pivot-capable datasets", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      const badges = items.map(
        (li) => (li.querySelector(".dataset-item-badge") as HTMLElement).hidden,
      );
      // Sales has pivot=true, others false
      expect(badges).toEqual([false, true, true]);
    });

    it("shows description when present, omits when empty", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      expect(
        items[0].querySelector(".dataset-item-desc")!.textContent,
      ).toBe("Quarterly sales figures");
      // Inventory has empty description — desc element should be removed
      expect(items[2].querySelector(".dataset-item-desc")).toBeNull();
    });

    it("shows empty state when no datasets are available", async () => {
      const el = await createElement(mockClient([]));
      expect(getEmptyState(el).hidden).toBe(false);
      expect(
        el.shadowRoot!.getElementById("empty-message")!.textContent,
      ).toBe("No datasets available");
    });

    it("renders nothing until client is set", async () => {
      const el = await createElement();
      expect(getItems(el)).toHaveLength(0);
    });
  });

  // --- Selection ---------------------------------------------------------

  describe("selection", () => {
    it("selects a dataset on click", async () => {
      const el = await createElement(mockClient());
      getItems(el)[1].click();
      // _render rebuilds the list, so re-query for fresh refs
      expect(getItems(el)[1].getAttribute("aria-selected")).toBe("true");
    });

    it("marks aria-selected on the selected item only", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      items[0].click();
      // Re-query because _render rebuilds the list
      const updated = getItems(el);
      const selected = updated.map(
        (li) => li.getAttribute("aria-selected"),
      );
      expect(selected).toEqual(["true", "false", "false"]);
    });

    it("does not emit event until Apply is clicked", async () => {
      const el = await createElement(mockClient());
      const handler = vi.fn();
      el.addEventListener("dataset-change", handler);

      getItems(el)[0].click();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // --- Dirty state -------------------------------------------------------

  describe("dirty state", () => {
    it("starts with Apply and Undo disabled", async () => {
      const el = await createElement(mockClient());
      expect(getApplyBtn(el).disabled).toBe(true);
      expect(getUndoBtn(el).disabled).toBe(true);
    });

    it("enables Apply and Undo after selecting a dataset", async () => {
      const el = await createElement(mockClient());
      getItems(el)[0].click();
      expect(getApplyBtn(el).disabled).toBe(false);
      expect(getUndoBtn(el).disabled).toBe(false);
    });

    it("shows dirty dot when selection differs from applied", async () => {
      const el = await createElement(mockClient());
      expect(getDirtyDot(el).hidden).toBe(true);
      getItems(el)[0].click();
      expect(getDirtyDot(el).hidden).toBe(false);
    });

    it("disables buttons after Apply", async () => {
      const el = await createElement(mockClient());
      getItems(el)[0].click();
      getApplyBtn(el).click();
      expect(getApplyBtn(el).disabled).toBe(true);
      expect(getUndoBtn(el).disabled).toBe(true);
      expect(getDirtyDot(el).hidden).toBe(true);
    });
  });

  // --- Apply / Undo ------------------------------------------------------

  describe("apply and undo", () => {
    it("emits dataset-change event on Apply", async () => {
      const el = await createElement(mockClient());
      const handler = vi.fn();
      el.addEventListener("dataset-change", handler);

      getItems(el)[0].click();
      getApplyBtn(el).click();

      expect(handler).toHaveBeenCalledOnce();
      const detail = (handler.mock.calls[0][0] as CustomEvent<DatasetChangeDetail>).detail;
      expect(detail.key).toBe("sales");
      expect(detail.label).toBe("Sales Data");
      expect(detail.capabilities.pivot).toBe(true);
    });

    it("invokes onDatasetChange callback on Apply", async () => {
      const el = await createElement(mockClient());
      const callback = vi.fn();
      el.onDatasetChange = callback;

      getItems(el)[1].click();
      getApplyBtn(el).click();

      expect(callback).toHaveBeenCalledOnce();
      expect(callback.mock.calls[0][0].key).toBe("employees");
    });

    it("updates value after Apply", async () => {
      const el = await createElement(mockClient());
      expect(el.value).toBeNull();

      getItems(el)[0].click();
      expect(el.value).toBeNull(); // not applied yet

      getApplyBtn(el).click();
      expect(el.value).toBe("sales");
    });

    it("reverts selection on Undo", async () => {
      const el = await createElement(mockClient());

      // Apply sales first
      getItems(el)[0].click();
      getApplyBtn(el).click();
      expect(el.value).toBe("sales");

      // Select a different dataset then undo
      getItems(el)[2].click();
      expect(getApplyBtn(el).disabled).toBe(false);

      getUndoBtn(el).click();
      expect(getApplyBtn(el).disabled).toBe(true);

      // The originally applied value should still be selected
      const selected = getItems(el).find(
        (li) => li.getAttribute("aria-selected") === "true",
      );
      expect(selected?.dataset.key).toBe("sales");
    });
  });

  // --- Search filtering --------------------------------------------------

  describe("search filtering", () => {
    it("filters datasets by label", async () => {
      const el = await createElement(mockClient());
      const input = getSearchInput(el);

      input.value = "sales";
      input.dispatchEvent(new Event("input"));

      const items = getItems(el);
      expect(items).toHaveLength(1);
      expect(items[0].dataset.key).toBe("sales");
    });

    it("filters datasets by key", async () => {
      const el = await createElement(mockClient());
      const input = getSearchInput(el);

      input.value = "employees";
      input.dispatchEvent(new Event("input"));

      expect(getItems(el)).toHaveLength(1);
      expect(getItems(el)[0].dataset.key).toBe("employees");
    });

    it("filters datasets by description", async () => {
      const el = await createElement(mockClient());
      const input = getSearchInput(el);

      input.value = "HR";
      input.dispatchEvent(new Event("input"));

      expect(getItems(el)).toHaveLength(1);
      expect(getItems(el)[0].dataset.key).toBe("employees");
    });

    it("is case-insensitive", async () => {
      const el = await createElement(mockClient());
      const input = getSearchInput(el);

      input.value = "INVENTORY";
      input.dispatchEvent(new Event("input"));

      expect(getItems(el)).toHaveLength(1);
    });

    it("shows empty state when no datasets match", async () => {
      const el = await createElement(mockClient());
      const input = getSearchInput(el);

      input.value = "nonexistent";
      input.dispatchEvent(new Event("input"));

      expect(getItems(el)).toHaveLength(0);
      expect(getEmptyState(el).hidden).toBe(false);
      expect(
        el.shadowRoot!.getElementById("empty-message")!.textContent,
      ).toBe("No datasets match your search");
    });

    it("restores full list when search is cleared", async () => {
      const el = await createElement(mockClient());
      const input = getSearchInput(el);

      input.value = "sales";
      input.dispatchEvent(new Event("input"));
      expect(getItems(el)).toHaveLength(1);

      input.value = "";
      input.dispatchEvent(new Event("input"));
      expect(getItems(el)).toHaveLength(3);
    });
  });

  // --- Keyboard navigation -----------------------------------------------

  describe("keyboard navigation", () => {
    it("selects on Enter key", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      items[1].dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      const updated = getItems(el);
      expect(updated[1].getAttribute("aria-selected")).toBe("true");
    });

    it("selects on Space key", async () => {
      const el = await createElement(mockClient());
      const items = getItems(el);
      items[2].dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
      const updated = getItems(el);
      expect(updated[2].getAttribute("aria-selected")).toBe("true");
    });
  });

  // --- Public API --------------------------------------------------------

  describe("public API", () => {
    it("setAppliedValue sets value without emitting", async () => {
      const el = await createElement(mockClient());
      const handler = vi.fn();
      el.addEventListener("dataset-change", handler);

      el.setAppliedValue("employees");

      expect(el.value).toBe("employees");
      expect(handler).not.toHaveBeenCalled();

      // The matching item should be selected
      const selected = getItems(el).find(
        (li) => li.getAttribute("aria-selected") === "true",
      );
      expect(selected?.dataset.key).toBe("employees");
    });

    it("refresh re-fetches datasets", async () => {
      const client = mockClient();
      const el = await createElement(client);
      const callsBefore = (client.listDatasets as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      await el.refresh();
      expect(client.listDatasets).toHaveBeenCalledTimes(callsBefore + 1);
    });

    it("setting client triggers a fetch", async () => {
      const el = await createElement();
      expect(getItems(el)).toHaveLength(0);

      const client = mockClient();
      el.client = client;
      await vi.waitFor(() => {});

      expect(client.listDatasets).toHaveBeenCalledOnce();
      expect(getItems(el)).toHaveLength(3);
    });
  });

  // --- Error handling ----------------------------------------------------

  describe("error handling", () => {
    it("renders empty list when listDatasets rejects", async () => {
      const client = mockClient();
      (client.listDatasets as ReturnType<typeof vi.fn>).mockRejectedValue(
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
      const searchInput = getSearchInput(el);
      const spy = vi.spyOn(searchInput, "removeEventListener");

      el.remove();

      expect(spy).toHaveBeenCalledWith("input", expect.any(Function));
    });
  });
});

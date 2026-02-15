// ---------------------------------------------------------------------------
// Tests for <sj-filter-basic>
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import { ColumnType } from "../src/types/columns";
import type { ColumnMeta } from "../src/types/columns";
import {
  FilterOperator,
  FilterCombinator,
  FilterStyle,
} from "../src/types/filters";
import type { FilterGroup } from "../src/types/filters";

import "../src/filter-builder/basic/basic-mode";
import { SanjayaFilterBasic } from "../src/filter-builder/basic/basic-mode";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COLUMNS: ColumnMeta[] = [
  {
    name: "year",
    label: "Year",
    type: ColumnType.Number,
    operators: [
      FilterOperator.Eq,
      FilterOperator.Gt,
      FilterOperator.Lt,
      FilterOperator.Between,
    ],
    nullable: false,
  },
  {
    name: "region",
    label: "Region",
    type: ColumnType.String,
    operators: [FilterOperator.Eq, FilterOperator.Contains, FilterOperator.In],
    nullable: false,
    filterStyle: FilterStyle.Select,
    enumValues: ["North", "South", "East", "West"],
  },
  {
    name: "amount",
    label: "Amount",
    type: ColumnType.Currency,
    operators: [
      FilterOperator.Eq,
      FilterOperator.Gt,
      FilterOperator.Lt,
      FilterOperator.Gte,
      FilterOperator.Lte,
      FilterOperator.Between,
    ],
    nullable: true,
  },
  {
    name: "active",
    label: "Active",
    type: ColumnType.Boolean,
    operators: [FilterOperator.Eq],
    nullable: false,
  },
  {
    name: "start_date",
    label: "Start Date",
    type: ColumnType.Date,
    operators: [
      FilterOperator.Eq,
      FilterOperator.Gt,
      FilterOperator.Lt,
      FilterOperator.Between,
      FilterOperator.IsNull,
      FilterOperator.IsNotNull,
    ],
    nullable: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function create(columns: ColumnMeta[] = COLUMNS): SanjayaFilterBasic {
  const el = document.createElement(
    "sj-filter-basic",
  ) as SanjayaFilterBasic;
  document.body.appendChild(el);
  el.columns = columns;
  return el;
}

function getRows(el: SanjayaFilterBasic): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>(
      "#conditions .condition-row",
    ),
  );
}

function colLabel(row: HTMLElement): string {
  return (row.querySelector(".col-label") as HTMLElement).textContent ?? "";
}

function opSelect(row: HTMLElement): HTMLSelectElement {
  return row.querySelector(".op-select") as HTMLSelectElement;
}

function valueField(row: HTMLElement): HTMLInputElement | null {
  return row.querySelector(".value-field") as HTMLInputElement | null;
}

function toggleActiveOnly(el: SanjayaFilterBasic): HTMLInputElement {
  return el.shadowRoot!.getElementById(
    "toggle-active-only",
  ) as HTMLInputElement;
}

function activeCountText(el: SanjayaFilterBasic): string {
  return el.shadowRoot!.getElementById("active-count")!.textContent ?? "";
}

function emptyState(el: SanjayaFilterBasic): HTMLElement {
  return el.shadowRoot!.getElementById("empty-state")!;
}

function selectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function typeValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sj-filter-basic", () => {
  // --- Rendering ---------------------------------------------------------

  describe("rendering", () => {
    it("renders one row per column", () => {
      const el = create();
      expect(getRows(el)).toHaveLength(COLUMNS.length);
    });

    it("each row shows the column label", () => {
      const el = create();
      const labels = getRows(el).map(colLabel);
      expect(labels).toEqual(["Year", "Region", "Amount", "Active", "Start Date"]);
    });

    it("operator dropdown defaults to ALL for every row", () => {
      const el = create();
      for (const row of getRows(el)) {
        expect(opSelect(row).value).toBe("ALL");
      }
    });

    it("operator dropdown shows column-specific operators", () => {
      const el = create();
      const yearOps = Array.from(opSelect(getRows(el)[0]).options).map(
        (o) => o.value,
      );
      // year: ALL + eq, gt, lt, between
      expect(yearOps).toEqual(["ALL", "eq", "gt", "lt", "between"]);
    });

    it("renders nothing when columns are empty", () => {
      const el = create([]);
      expect(getRows(el)).toHaveLength(0);
    });

    it("region row shows only ALL and 'is one of' (filterStyle select)", () => {
      const el = create();
      const regionRow = getRows(el)[1]; // region is 2nd column
      const ops = Array.from(opSelect(regionRow).options).map(
        (o) => o.value,
      );
      expect(ops).toEqual(["ALL", "in"]);
    });
  });

  // --- Value input adaptation --------------------------------------------

  describe("value input adaptation", () => {
    it("shows no value for ALL", () => {
      const el = create();
      expect(valueField(getRows(el)[0])).toBeNull();
    });

    it("shows number input for numeric column", () => {
      const el = create();
      selectValue(opSelect(getRows(el)[0]), "gt");
      const inp = valueField(getRows(el)[0]);
      expect(inp).not.toBeNull();
      expect(inp!.type).toBe("number");
    });

    it("shows no value for isNull", () => {
      const el = create();
      const dateRow = getRows(el)[4]; // start_date is 5th column
      selectValue(opSelect(dateRow), "isNull");
      const updatedDateRow = getRows(el)[4];
      expect(valueField(updatedDateRow)).toBeNull();
    });

    it("shows two inputs for between", () => {
      const el = create();
      selectValue(opSelect(getRows(el)[0]), "between");
      const row = getRows(el)[0];
      expect(row.querySelector(".value-from")).not.toBeNull();
      expect(row.querySelector(".value-to")).not.toBeNull();
    });

    it("shows multi-select for filterStyle:select column", () => {
      const el = create();
      const regionRow = getRows(el)[1];
      selectValue(opSelect(regionRow), "in");
      const checks = getRows(el)[1].querySelectorAll(".multi-check");
      expect(checks).toHaveLength(4);
    });

    it("shows boolean toggle for boolean column", () => {
      const el = create();
      const activeRow = getRows(el)[3]; // active is 4th column
      selectValue(opSelect(activeRow), "eq");
      const cb = getRows(el)[3].querySelector(
        ".value-bool",
      ) as HTMLInputElement;
      expect(cb).not.toBeNull();
      expect(cb.type).toBe("checkbox");
    });

    it("shows date input for date column", () => {
      const el = create();
      const dateRow = getRows(el)[4];
      selectValue(opSelect(dateRow), "eq");
      const inp = valueField(getRows(el)[4]);
      expect(inp).not.toBeNull();
      expect(inp!.type).toBe("date");
    });
  });

  // --- Active-only toggle ------------------------------------------------

  describe("active-only toggle", () => {
    it("shows all rows by default", () => {
      const el = create();
      expect(getRows(el)).toHaveLength(5);
      expect(toggleActiveOnly(el).checked).toBe(false);
    });

    it("hides inactive rows when toggled on", () => {
      const el = create();
      // Activate one filter
      selectValue(opSelect(getRows(el)[0]), "gt");
      typeValue(valueField(getRows(el)[0])!, "2020");

      // Toggle active only
      toggleActiveOnly(el).checked = true;
      toggleActiveOnly(el).dispatchEvent(new Event("change"));

      const rows = getRows(el);
      expect(rows).toHaveLength(1);
      expect(colLabel(rows[0])).toBe("Year");
    });

    it("shows empty state when active-only is on and no filters active", () => {
      const el = create();
      toggleActiveOnly(el).checked = true;
      toggleActiveOnly(el).dispatchEvent(new Event("change"));

      expect(getRows(el)).toHaveLength(0);
      expect(emptyState(el).hidden).toBe(false);
    });

    it("hides empty state when not in active-only mode", () => {
      const el = create();
      expect(emptyState(el).hidden).toBe(true);
    });

    it("shows all rows again when toggled off", () => {
      const el = create();
      selectValue(opSelect(getRows(el)[0]), "gt");

      // Toggle on
      toggleActiveOnly(el).checked = true;
      toggleActiveOnly(el).dispatchEvent(new Event("change"));
      expect(getRows(el)).toHaveLength(1);

      // Toggle off
      toggleActiveOnly(el).checked = false;
      toggleActiveOnly(el).dispatchEvent(new Event("change"));
      expect(getRows(el)).toHaveLength(5);
    });

    it("displays active count", () => {
      const el = create();
      expect(activeCountText(el)).toBe("");

      selectValue(opSelect(getRows(el)[0]), "gt");
      expect(activeCountText(el)).toBe("1 active");

      selectValue(opSelect(getRows(el)[2]), "gte");
      expect(activeCountText(el)).toBe("2 active");
    });

    it("can be set programmatically", () => {
      const el = create();
      el.activeOnly = true;
      expect(toggleActiveOnly(el).checked).toBe(true);
      expect(getRows(el)).toHaveLength(0);
    });
  });

  // --- filter-dirty event ------------------------------------------------

  describe("filter-dirty event", () => {
    it("emits on operator change", () => {
      const el = create();
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      selectValue(opSelect(getRows(el)[0]), "gt");
      expect(handler).toHaveBeenCalledOnce();
    });

    it("emits on value input", () => {
      const el = create();
      selectValue(opSelect(getRows(el)[0]), "gt");
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      typeValue(valueField(getRows(el)[0])!, "2020");
      expect(handler).toHaveBeenCalledOnce();
    });

    it("detail is a FilterGroup", () => {
      const el = create();
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      selectValue(opSelect(getRows(el)[0]), "gt");
      typeValue(valueField(getRows(el)[0])!, "2020");
      const detail = (
        handler.mock.calls[handler.mock.calls.length - 1][0] as CustomEvent<FilterGroup>
      ).detail;
      expect(detail.combinator).toBe("and");
      expect(detail.conditions).toHaveLength(1);
      expect(detail.conditions![0].column).toBe("year");
      expect(detail.conditions![0].operator).toBe("gt");
      expect(detail.conditions![0].value).toBe("2020");
    });

    it("ALL conditions excluded from emitted FilterGroup", () => {
      const el = create();
      // Set one filter on amount (3rd row, index 2)
      selectValue(opSelect(getRows(el)[2]), "gt");
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      typeValue(valueField(getRows(el)[2])!, "100");
      const detail = (
        handler.mock.calls[0][0] as CustomEvent<FilterGroup>
      ).detail;
      // Only the amount condition should be in the group
      expect(detail.conditions).toHaveLength(1);
      expect(detail.conditions![0].column).toBe("amount");
    });

    it("between produces array value", () => {
      const el = create();
      selectValue(opSelect(getRows(el)[0]), "between");
      const from = getRows(el)[0].querySelector(
        ".value-from",
      ) as HTMLInputElement;
      const to = getRows(el)[0].querySelector(
        ".value-to",
      ) as HTMLInputElement;
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      typeValue(from, "2020");
      typeValue(to, "2025");
      const detail = (
        handler.mock.calls[handler.mock.calls.length - 1][0] as CustomEvent<FilterGroup>
      ).detail;
      expect(detail.conditions![0].value).toEqual(["2020", "2025"]);
    });

    it("multi-select produces array value", () => {
      const el = create();
      const regionRow = getRows(el)[1];
      selectValue(opSelect(regionRow), "in");
      const checks = getRows(el)[1].querySelectorAll<HTMLInputElement>(
        ".multi-check",
      );
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      checks[0].checked = true;
      checks[0].dispatchEvent(new Event("change", { bubbles: true }));
      checks[2].checked = true;
      checks[2].dispatchEvent(new Event("change", { bubbles: true }));
      const detail = (
        handler.mock.calls[handler.mock.calls.length - 1][0] as CustomEvent<FilterGroup>
      ).detail;
      expect(detail.conditions![0].value).toEqual(["North", "East"]);
    });
  });

  // --- filterGroup property ----------------------------------------------

  describe("filterGroup property", () => {
    it("returns empty filter when all rows are ALL", () => {
      const el = create();
      expect(el.filterGroup.conditions).toHaveLength(0);
    });

    it("returns current working state", () => {
      const el = create();
      selectValue(opSelect(getRows(el)[0]), "gt");
      typeValue(valueField(getRows(el)[0])!, "2020");
      const fg = el.filterGroup;
      expect(fg.conditions).toHaveLength(1);
      expect(fg.conditions![0].operator).toBe("gt");
    });
  });

  // --- loadFilterGroup ---------------------------------------------------

  describe("loadFilterGroup", () => {
    it("renders conditions from a compatible FilterGroup", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [
          { column: "year", operator: FilterOperator.Gt, value: "2020" },
        ],
        groups: [],
      });
      const rows = getRows(el);
      // Still shows all columns
      expect(rows).toHaveLength(5);
      // Year row should have gt operator
      expect(opSelect(rows[0]).value).toBe("gt");
      // Other rows should still be ALL
      expect(opSelect(rows[1]).value).toBe("ALL");
    });

    it("resets to ALL rows for incompatible (OR) FilterGroup", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.Or,
        conditions: [
          { column: "year", operator: FilterOperator.Gt, value: "2020" },
        ],
        groups: [],
      });
      const rows = getRows(el);
      expect(rows).toHaveLength(5);
      for (const row of rows) {
        expect(opSelect(row).value).toBe("ALL");
      }
    });

    it("resets to ALL rows for incompatible (nested groups) FilterGroup", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [],
        groups: [
          {
            combinator: FilterCombinator.And,
            conditions: [],
            groups: [],
          },
        ],
      });
      const rows = getRows(el);
      expect(rows).toHaveLength(5);
      for (const row of rows) {
        expect(opSelect(row).value).toBe("ALL");
      }
    });
  });

  // --- Lifecycle ---------------------------------------------------------

  describe("lifecycle", () => {
    it("removes event listeners on disconnect", () => {
      const el = create();
      const spy = vi.spyOn(
        el.shadowRoot!.getElementById(
          "toggle-active-only",
        ) as HTMLInputElement,
        "removeEventListener",
      );
      el.remove();
      expect(spy).toHaveBeenCalledWith("change", expect.any(Function));
    });
  });
});

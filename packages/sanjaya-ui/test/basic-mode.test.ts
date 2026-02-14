// ---------------------------------------------------------------------------
// Tests for <sj-filter-basic>
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import { ColumnType } from "../src/types/columns.js";
import type { ColumnMeta } from "../src/types/columns.js";
import {
  FilterOperator,
  FilterCombinator,
  FilterStyle,
} from "../src/types/filters.js";
import type { FilterGroup } from "../src/types/filters.js";

import "../src/filter-builder/basic/basic-mode.js";
import { SanjayaFilterBasic } from "../src/filter-builder/basic/basic-mode.js";

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

function colSelect(row: HTMLElement): HTMLSelectElement {
  return row.querySelector(".col-select") as HTMLSelectElement;
}

function opSelect(row: HTMLElement): HTMLSelectElement {
  return row.querySelector(".op-select") as HTMLSelectElement;
}

function valueField(row: HTMLElement): HTMLInputElement | null {
  return row.querySelector(".value-field") as HTMLInputElement | null;
}

function addBtn(el: SanjayaFilterBasic): HTMLButtonElement {
  return el.shadowRoot!.getElementById(
    "btn-add-condition",
  ) as HTMLButtonElement;
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
    it("renders one default condition row", () => {
      const el = create();
      expect(getRows(el)).toHaveLength(1);
    });

    it("column dropdown contains all columns", () => {
      const el = create();
      const opts = Array.from(colSelect(getRows(el)[0]).options).map(
        (o) => o.value,
      );
      expect(opts).toEqual([
        "year",
        "region",
        "amount",
        "active",
        "start_date",
      ]);
    });

    it("operator dropdown defaults to ALL", () => {
      const el = create();
      expect(opSelect(getRows(el)[0]).value).toBe("ALL");
    });

    it("operator dropdown shows column-specific operators", () => {
      const el = create();
      const ops = Array.from(opSelect(getRows(el)[0]).options).map(
        (o) => o.value,
      );
      // year: ALL + eq, gt, lt, between
      expect(ops).toEqual(["ALL", "eq", "gt", "lt", "between"]);
    });

    it("renders nothing when columns are empty", () => {
      const el = create([]);
      expect(getRows(el)).toHaveLength(0);
    });

    it("region column shows only ALL and 'is one of' (filterStyle select)", () => {
      const el = create();
      selectValue(colSelect(getRows(el)[0]), "region");
      const rows = getRows(el);
      const ops = Array.from(opSelect(rows[0]).options).map(
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
      selectValue(colSelect(getRows(el)[0]), "start_date");
      selectValue(opSelect(getRows(el)[0]), "isNull");
      expect(valueField(getRows(el)[0])).toBeNull();
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
      selectValue(colSelect(getRows(el)[0]), "region");
      selectValue(opSelect(getRows(el)[0]), "in");
      const checks = getRows(el)[0].querySelectorAll(".multi-check");
      expect(checks).toHaveLength(4);
    });

    it("shows boolean toggle for boolean column", () => {
      const el = create();
      selectValue(colSelect(getRows(el)[0]), "active");
      selectValue(opSelect(getRows(el)[0]), "eq");
      const cb = getRows(el)[0].querySelector(
        ".value-bool",
      ) as HTMLInputElement;
      expect(cb).not.toBeNull();
      expect(cb.type).toBe("checkbox");
    });

    it("shows date input for date column", () => {
      const el = create();
      selectValue(colSelect(getRows(el)[0]), "start_date");
      selectValue(opSelect(getRows(el)[0]), "eq");
      const inp = valueField(getRows(el)[0]);
      expect(inp).not.toBeNull();
      expect(inp!.type).toBe("date");
    });

    it("updates operator list when column changes", () => {
      const el = create();
      selectValue(colSelect(getRows(el)[0]), "active");
      const ops = Array.from(opSelect(getRows(el)[0]).options).map(
        (o) => o.value,
      );
      expect(ops).toEqual(["ALL", "eq"]);
    });
  });

  // --- Add / remove conditions -------------------------------------------

  describe("add and remove conditions", () => {
    it("adds a condition row", () => {
      const el = create();
      addBtn(el).click();
      expect(getRows(el)).toHaveLength(2);
    });

    it("removes a condition row", () => {
      const el = create();
      addBtn(el).click();
      const btn = getRows(el)[0].querySelector(
        ".remove-condition",
      ) as HTMLButtonElement;
      btn.click();
      expect(getRows(el)).toHaveLength(1);
    });

    it("can remove all rows", () => {
      const el = create();
      const btn = getRows(el)[0].querySelector(
        ".remove-condition",
      ) as HTMLButtonElement;
      btn.click();
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

    it("emits on add condition", () => {
      const el = create();
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      addBtn(el).click();
      expect(handler).toHaveBeenCalledOnce();
    });

    it("emits on remove condition", () => {
      const el = create();
      addBtn(el).click();
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      const btn = getRows(el)[0].querySelector(
        ".remove-condition",
      ) as HTMLButtonElement;
      btn.click();
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
      addBtn(el).click();
      // Row 0 stays ALL; row 1: set gt + value
      selectValue(colSelect(getRows(el)[1]), "amount");
      selectValue(opSelect(getRows(el)[1]), "gt");
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      typeValue(valueField(getRows(el)[1])!, "100");
      const detail = (
        handler.mock.calls[0][0] as CustomEvent<FilterGroup>
      ).detail;
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
      selectValue(colSelect(getRows(el)[0]), "region");
      selectValue(opSelect(getRows(el)[0]), "in");
      const checks = getRows(el)[0].querySelectorAll<HTMLInputElement>(
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
      const yearRow = rows.find(
        (r) => colSelect(r).value === "year",
      );
      expect(yearRow).toBeDefined();
      expect(opSelect(yearRow!).value).toBe("gt");
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
      expect(rows).toHaveLength(1);
      expect(opSelect(rows[0]).value).toBe("ALL");
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
      expect(rows).toHaveLength(1);
      expect(opSelect(rows[0]).value).toBe("ALL");
    });
  });

  // --- Lifecycle ---------------------------------------------------------

  describe("lifecycle", () => {
    it("removes event listeners on disconnect", () => {
      const el = create();
      const spy = vi.spyOn(
        el.shadowRoot!.getElementById(
          "btn-add-condition",
        ) as HTMLButtonElement,
        "removeEventListener",
      );
      el.remove();
      expect(spy).toHaveBeenCalledWith("click", expect.any(Function));
    });
  });
});

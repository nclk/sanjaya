// ---------------------------------------------------------------------------
// Tests for <sj-filter-advanced>
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import { ColumnType } from "../src/types/columns";
import type { ColumnMeta } from "../src/types/columns";
import {
  FilterOperator,
  FilterCombinator,
} from "../src/types/filters";
import type { FilterGroup, FilterCondition } from "../src/types/filters";

import "../src/filter-builder/advanced/advanced-mode.js";
import { SanjayaFilterAdvanced } from "../src/filter-builder/advanced/advanced-mode";

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

function create(columns: ColumnMeta[] = COLUMNS): SanjayaFilterAdvanced {
  const el = document.createElement(
    "sj-filter-advanced",
  ) as SanjayaFilterAdvanced;
  document.body.appendChild(el);
  el.columns = columns;
  return el;
}

/** Returns the root .filter-group element. */
function rootGroup(el: SanjayaFilterAdvanced): HTMLElement | null {
  return el.shadowRoot!.querySelector("#root > .filter-group");
}

/** Returns direct condition rows of a group element. */
function conditionRows(groupEl: HTMLElement): HTMLElement[] {
  const container = groupEl.querySelector(
    ":scope > .group-conditions",
  ) as HTMLElement | null;
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(":scope > .condition-row"),
  ) as HTMLElement[];
}

/** Returns direct sub-group elements of a group element. */
function subGroups(groupEl: HTMLElement): HTMLElement[] {
  const container = groupEl.querySelector(
    ":scope > .group-subgroups",
  ) as HTMLElement | null;
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(":scope > .filter-group"),
  ) as HTMLElement[];
}

function addConditionBtn(groupEl: HTMLElement): HTMLButtonElement {
  return groupEl.querySelector(
    ":scope > .group-header .add-condition-btn",
  ) as HTMLButtonElement;
}

function addGroupBtn(groupEl: HTMLElement): HTMLButtonElement {
  return groupEl.querySelector(
    ":scope > .group-header .add-group-btn",
  ) as HTMLButtonElement;
}

function removeGroupBtn(groupEl: HTMLElement): HTMLButtonElement {
  return groupEl.querySelector(
    ":scope > .group-header .remove-group-btn",
  ) as HTMLButtonElement;
}

function andBtn(groupEl: HTMLElement): HTMLButtonElement {
  return groupEl.querySelector(
    ":scope > .group-header .combinator-and",
  ) as HTMLButtonElement;
}

function orBtn(groupEl: HTMLElement): HTMLButtonElement {
  return groupEl.querySelector(
    ":scope > .group-header .combinator-or",
  ) as HTMLButtonElement;
}

function groupNotCheck(groupEl: HTMLElement): HTMLInputElement {
  return groupEl.querySelector(
    ":scope > .group-header .group-not-check",
  ) as HTMLInputElement;
}

function colSelect(row: HTMLElement): HTMLSelectElement {
  return row.querySelector(".col-select") as HTMLSelectElement;
}

function opSelect(row: HTMLElement): HTMLSelectElement {
  return row.querySelector(".op-select") as HTMLSelectElement;
}

function condNotCheck(row: HTMLElement): HTMLInputElement {
  return row.querySelector(".condition-not-check") as HTMLInputElement;
}

function removeCondBtn(row: HTMLElement): HTMLButtonElement {
  return row.querySelector(".remove-condition") as HTMLButtonElement;
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
// Helper FilterGroup factories
// ---------------------------------------------------------------------------

function simpleGroup(): FilterGroup {
  return {
    combinator: FilterCombinator.And,
    conditions: [
      { column: "year", operator: FilterOperator.Gt, value: "2020" },
      { column: "region", operator: FilterOperator.Eq, value: "North" },
    ],
    groups: [],
  };
}

function nestedGroup(): FilterGroup {
  return {
    combinator: FilterCombinator.And,
    conditions: [
      { column: "year", operator: FilterOperator.Gt, value: "2020" },
    ],
    groups: [
      {
        combinator: FilterCombinator.Or,
        conditions: [
          { column: "region", operator: FilterOperator.Eq, value: "North" },
          { column: "region", operator: FilterOperator.Eq, value: "South" },
        ],
        groups: [],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sj-filter-advanced", () => {
  // --- Rendering from loadFilterGroup ------------------------------------

  describe("loadFilterGroup rendering", () => {
    it("renders an empty root group by default", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [],
        groups: [],
      });
      const rg = rootGroup(el);
      expect(rg).not.toBeNull();
      expect(conditionRows(rg!)).toHaveLength(0);
      expect(subGroups(rg!)).toHaveLength(0);
    });

    it("renders conditions in root group", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const rg = rootGroup(el)!;
      const rows = conditionRows(rg);
      expect(rows).toHaveLength(2);
      expect(colSelect(rows[0]).value).toBe("year");
      expect(opSelect(rows[0]).value).toBe("gt");
      expect(colSelect(rows[1]).value).toBe("region");
      expect(opSelect(rows[1]).value).toBe("eq");
    });

    it("renders nested sub-groups", () => {
      const el = create();
      el.loadFilterGroup(nestedGroup());
      const rg = rootGroup(el)!;
      const subs = subGroups(rg);
      expect(subs).toHaveLength(1);
      const subConditions = conditionRows(subs[0]);
      expect(subConditions).toHaveLength(2);
    });

    it("renders combinator correctly (root AND, sub OR)", () => {
      const el = create();
      el.loadFilterGroup(nestedGroup());
      const rg = rootGroup(el)!;
      expect(andBtn(rg).getAttribute("aria-pressed")).toBe("true");
      expect(orBtn(rg).getAttribute("aria-pressed")).toBe("false");

      const sub = subGroups(rg)[0];
      expect(andBtn(sub).getAttribute("aria-pressed")).toBe("false");
      expect(orBtn(sub).getAttribute("aria-pressed")).toBe("true");
    });

    it("renders group NOT toggle", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        not: true,
        conditions: [],
        groups: [],
      });
      expect(groupNotCheck(rootGroup(el)!).checked).toBe(true);
    });

    it("renders condition NOT toggle", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [
          {
            column: "year",
            operator: FilterOperator.Gt,
            value: "2020",
            not: true,
          },
        ],
        groups: [],
      });
      const rows = conditionRows(rootGroup(el)!);
      expect(condNotCheck(rows[0]).checked).toBe(true);
    });

    it("hides remove button for root group", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      expect(removeGroupBtn(rootGroup(el)!).hidden).toBe(true);
    });

    it("shows remove button for sub-groups", () => {
      const el = create();
      el.loadFilterGroup(nestedGroup());
      const sub = subGroups(rootGroup(el)!)[0];
      expect(removeGroupBtn(sub).hidden).toBe(false);
    });

    it("renders column dropdown with all columns", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const rows = conditionRows(rootGroup(el)!);
      const opts = Array.from(colSelect(rows[0]).options).map(
        (o) => o.value,
      );
      expect(opts).toEqual(["year", "region", "amount", "start_date"]);
    });

    it("operator dropdown has no ALL entry (advanced mode)", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const rows = conditionRows(rootGroup(el)!);
      const ops = Array.from(opSelect(rows[0]).options).map(
        (o) => o.value,
      );
      expect(ops).not.toContain("ALL");
    });

    it("renders Between value with two inputs", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [
          {
            column: "year",
            operator: FilterOperator.Between,
            value: ["2020", "2025"],
          },
        ],
        groups: [],
      });
      const row = conditionRows(rootGroup(el)!)[0];
      const from = row.querySelector(".value-from") as HTMLInputElement;
      const to = row.querySelector(".value-to") as HTMLInputElement;
      expect(from).not.toBeNull();
      expect(to).not.toBeNull();
      expect(from.value).toBe("2020");
      expect(to.value).toBe("2025");
    });
  });

  // --- Add condition / group ---------------------------------------------

  describe("add condition", () => {
    it("adds a condition row on click", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [],
        groups: [],
      });
      addConditionBtn(rootGroup(el)!).click();
      expect(conditionRows(rootGroup(el)!)).toHaveLength(1);
    });

    it("added condition defaults to first column + operator", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [],
        groups: [],
      });
      addConditionBtn(rootGroup(el)!).click();
      const row = conditionRows(rootGroup(el)!)[0];
      expect(colSelect(row).value).toBe("year");
      expect(opSelect(row).value).toBe("eq");
    });

    it("emits filter-dirty on add condition", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [],
        groups: [],
      });
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      addConditionBtn(rootGroup(el)!).click();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("add sub-group", () => {
    it("adds a sub-group on click", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [],
        groups: [],
      });
      addGroupBtn(rootGroup(el)!).click();
      expect(subGroups(rootGroup(el)!)).toHaveLength(1);
    });

    it("emits filter-dirty on add group", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [],
        groups: [],
      });
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      addGroupBtn(rootGroup(el)!).click();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // --- Remove condition / group ------------------------------------------

  describe("remove condition", () => {
    it("removes a condition row", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const rg = rootGroup(el)!;
      const rows = conditionRows(rg);
      removeCondBtn(rows[0]).click();
      expect(conditionRows(rootGroup(el)!)).toHaveLength(1);
    });

    it("remaining condition has correct column", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      removeCondBtn(conditionRows(rootGroup(el)!)[0]).click();
      const rows = conditionRows(rootGroup(el)!);
      expect(colSelect(rows[0]).value).toBe("region");
    });

    it("emits filter-dirty on remove", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      removeCondBtn(conditionRows(rootGroup(el)!)[0]).click();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("remove group", () => {
    it("removes a sub-group", () => {
      const el = create();
      el.loadFilterGroup(nestedGroup());
      const sub = subGroups(rootGroup(el)!)[0];
      removeGroupBtn(sub).click();
      expect(subGroups(rootGroup(el)!)).toHaveLength(0);
    });

    it("emits filter-dirty on remove group", () => {
      const el = create();
      el.loadFilterGroup(nestedGroup());
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      const sub = subGroups(rootGroup(el)!)[0];
      removeGroupBtn(sub).click();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // --- Combinator toggle -------------------------------------------------

  describe("combinator toggle", () => {
    it("switches from AND to OR", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const rg = rootGroup(el)!;
      orBtn(rg).click();
      expect(andBtn(rootGroup(el)!).getAttribute("aria-pressed")).toBe(
        "false",
      );
      expect(orBtn(rootGroup(el)!).getAttribute("aria-pressed")).toBe(
        "true",
      );
    });

    it("filterGroup reflects combinator change", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      orBtn(rootGroup(el)!).click();
      expect(el.filterGroup.combinator).toBe("or");
    });

    it("emits filter-dirty on combinator change", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      orBtn(rootGroup(el)!).click();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // --- NOT toggles -------------------------------------------------------

  describe("NOT toggles", () => {
    it("group NOT reflects in filterGroup", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const rg = rootGroup(el)!;
      const notCb = groupNotCheck(rg);
      notCb.checked = true;
      notCb.dispatchEvent(new Event("change", { bubbles: true }));
      expect(el.filterGroup.not).toBe(true);
    });

    it("condition NOT reflects in filterGroup", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const row = conditionRows(rootGroup(el)!)[0];
      const notCb = condNotCheck(row);
      notCb.checked = true;
      notCb.dispatchEvent(new Event("change", { bubbles: true }));
      expect(el.filterGroup.conditions![0].not).toBe(true);
    });

    it("emits filter-dirty on NOT change", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      const notCb = groupNotCheck(rootGroup(el)!);
      notCb.checked = true;
      notCb.dispatchEvent(new Event("change", { bubbles: true }));
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // --- filterGroup property (read-back) ----------------------------------

  describe("filterGroup property", () => {
    it("returns the loaded FilterGroup unchanged", () => {
      const el = create();
      const fg = simpleGroup();
      el.loadFilterGroup(fg);
      const result = el.filterGroup;
      expect(result.combinator).toBe("and");
      expect(result.conditions).toHaveLength(2);
      expect(result.conditions![0].column).toBe("year");
      expect(result.conditions![0].operator).toBe("gt");
      expect(result.conditions![1].column).toBe("region");
    });

    it("preserves nested groups in filterGroup", () => {
      const el = create();
      el.loadFilterGroup(nestedGroup());
      const result = el.filterGroup;
      expect(result.groups).toHaveLength(1);
      expect(result.groups![0].combinator).toBe("or");
      expect(result.groups![0].conditions).toHaveLength(2);
    });
  });

  // --- Interactivity — value editing ------------------------------------

  describe("value editing", () => {
    it("value input emits filter-dirty", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const row = conditionRows(rootGroup(el)!)[0];
      const inp = row.querySelector(".value-field") as HTMLInputElement;
      const handler = vi.fn();
      el.addEventListener("filter-dirty", handler);
      typeValue(inp, "2025");
      expect(handler).toHaveBeenCalledOnce();
    });

    it("column change updates operator list", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const row = conditionRows(rootGroup(el)!)[0];
      selectValue(colSelect(row), "start_date");
      // After re-render, the row for index 0 should now have start_date operators
      const updatedRow = conditionRows(rootGroup(el)!)[0];
      const ops = Array.from(opSelect(updatedRow).options).map(
        (o) => o.value,
      );
      expect(ops).toContain("isNull");
      expect(ops).toContain("isNotNull");
    });

    it("operator change updates value widget", () => {
      const el = create();
      el.loadFilterGroup({
        combinator: FilterCombinator.And,
        conditions: [
          { column: "year", operator: FilterOperator.Eq, value: "2020" },
        ],
        groups: [],
      });
      const row = conditionRows(rootGroup(el)!)[0];
      selectValue(opSelect(row), "between");
      const updatedRow = conditionRows(rootGroup(el)!)[0];
      expect(updatedRow.querySelector(".value-from")).not.toBeNull();
      expect(updatedRow.querySelector(".value-to")).not.toBeNull();
    });
  });

  // --- Lifecycle ---------------------------------------------------------

  describe("lifecycle", () => {
    it("registers as sj-filter-advanced", () => {
      expect(
        customElements.get("sj-filter-advanced"),
      ).toBe(SanjayaFilterAdvanced);
    });

    it("cleans up listeners on disconnect", () => {
      const el = create();
      el.loadFilterGroup(simpleGroup());
      const rootEl = el.shadowRoot!.getElementById("root")!;
      const spy = vi.spyOn(rootEl, "removeEventListener");
      el.remove();
      expect(spy).toHaveBeenCalledWith("change", expect.any(Function));
      expect(spy).toHaveBeenCalledWith("input", expect.any(Function));
      expect(spy).toHaveBeenCalledWith("click", expect.any(Function));
    });
  });
});

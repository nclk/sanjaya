// ---------------------------------------------------------------------------
// Tests for filter-builder/value-widgets.ts — DOM widget rendering & reading
// ---------------------------------------------------------------------------

import { describe, it, expect, afterEach } from "vitest";
import { ColumnType } from "../src/types/columns.js";
import type { ColumnMeta } from "../src/types/columns.js";
import { FilterOperator, FilterStyle } from "../src/types/filters.js";
import type { BasicRow } from "../src/filter-builder/helpers.js";
import {
  renderValueWidget,
  readValueFromRow,
  readConditionValue,
} from "../src/filter-builder/value-widgets.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "value-input";
  document.body.appendChild(div);
  return div;
}

/** Wrap a value widget inside a `.condition-row` so `readValueFromRow` can query it. */
function wrapInRow(widget: HTMLElement): HTMLElement {
  const row = document.createElement("div");
  row.className = "condition-row";
  row.appendChild(widget);
  document.body.appendChild(row);
  return row;
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const numCol: ColumnMeta = {
  name: "year",
  label: "Year",
  type: ColumnType.Number,
  operators: [FilterOperator.Eq, FilterOperator.Gt],
  nullable: false,
};

const dateCol: ColumnMeta = {
  name: "d",
  label: "Date",
  type: ColumnType.Date,
  operators: [FilterOperator.Eq],
  nullable: false,
};

const dtCol: ColumnMeta = {
  name: "dt",
  label: "Datetime",
  type: ColumnType.Datetime,
  operators: [FilterOperator.Eq],
  nullable: false,
};

const boolCol: ColumnMeta = {
  name: "active",
  label: "Active",
  type: ColumnType.Boolean,
  operators: [FilterOperator.Eq],
  nullable: false,
};

const selectCol: ColumnMeta = {
  name: "region",
  label: "Region",
  type: ColumnType.String,
  operators: [FilterOperator.In],
  nullable: false,
  filterStyle: FilterStyle.Select,
  enumValues: ["North", "South", "East", "West"],
};

const stringCol: ColumnMeta = {
  name: "tags",
  label: "Tags",
  type: ColumnType.String,
  operators: [FilterOperator.Eq, FilterOperator.In],
  nullable: false,
};

// ---------------------------------------------------------------------------
// renderValueWidget
// ---------------------------------------------------------------------------

describe("renderValueWidget", () => {
  it("renders nothing for ALL operator", () => {
    const c = makeContainer();
    const row: BasicRow = { column: "year", operator: "ALL", value: undefined };
    renderValueWidget(c, numCol, row);
    expect(c.children).toHaveLength(0);
  });

  it("renders nothing for isNull operator", () => {
    const c = makeContainer();
    const row: BasicRow = {
      column: "year",
      operator: FilterOperator.IsNull,
      value: undefined,
    };
    renderValueWidget(c, numCol, row);
    expect(c.children).toHaveLength(0);
  });

  it("renders nothing for isNotNull operator", () => {
    const c = makeContainer();
    const row: BasicRow = {
      column: "year",
      operator: FilterOperator.IsNotNull,
      value: undefined,
    };
    renderValueWidget(c, numCol, row);
    expect(c.children).toHaveLength(0);
  });

  it("renders number input for numeric column", () => {
    const c = makeContainer();
    const row: BasicRow = {
      column: "year",
      operator: FilterOperator.Gt,
      value: "2020",
    };
    renderValueWidget(c, numCol, row);
    const inp = c.querySelector(".value-field") as HTMLInputElement;
    expect(inp).not.toBeNull();
    expect(inp.type).toBe("number");
    expect(inp.value).toBe("2020");
  });

  it("renders date input for date column", () => {
    const c = makeContainer();
    const row: BasicRow = {
      column: "d",
      operator: FilterOperator.Eq,
      value: "2025-01-15",
    };
    renderValueWidget(c, dateCol, row);
    const inp = c.querySelector(".value-field") as HTMLInputElement;
    expect(inp.type).toBe("date");
    expect(inp.value).toBe("2025-01-15");
  });

  it("renders datetime-local input for datetime column", () => {
    const c = makeContainer();
    const row: BasicRow = {
      column: "dt",
      operator: FilterOperator.Eq,
      value: "",
    };
    renderValueWidget(c, dtCol, row);
    const inp = c.querySelector(".value-field") as HTMLInputElement;
    expect(inp.type).toBe("datetime-local");
  });

  it("renders two inputs for Between — replaces container", () => {
    const c = makeContainer();
    const parent = c.parentElement!;
    const row: BasicRow = {
      column: "year",
      operator: FilterOperator.Between,
      value: "2020",
      valueTo: "2025",
    };
    renderValueWidget(c, numCol, row);
    // Container was replaced by .value-between
    const wrap = parent.querySelector(".value-between");
    expect(wrap).not.toBeNull();
    const from = wrap!.querySelector(".value-from") as HTMLInputElement;
    const to = wrap!.querySelector(".value-to") as HTMLInputElement;
    expect(from.value).toBe("2020");
    expect(to.value).toBe("2025");
    expect(from.type).toBe("number");
  });

  it("renders multi-select checkboxes for select column", () => {
    const c = makeContainer();
    const parent = c.parentElement!;
    const row: BasicRow = {
      column: "region",
      operator: FilterOperator.In,
      value: ["North", "East"],
    };
    renderValueWidget(c, selectCol, row);
    // Container was replaced by .multi-select
    const wrap = parent.querySelector(".multi-select");
    expect(wrap).not.toBeNull();
    const checks = wrap!.querySelectorAll<HTMLInputElement>(".multi-check");
    expect(checks).toHaveLength(4);
    expect(checks[0].checked).toBe(true); // North
    expect(checks[1].checked).toBe(false); // South
    expect(checks[2].checked).toBe(true); // East
    expect(checks[3].checked).toBe(false); // West
  });

  it("renders boolean checkbox for boolean column", () => {
    const c = makeContainer();
    const parent = c.parentElement!;
    const row: BasicRow = {
      column: "active",
      operator: FilterOperator.Eq,
      value: true,
    };
    renderValueWidget(c, boolCol, row);
    const wrap = parent.querySelector(".bool-toggle");
    expect(wrap).not.toBeNull();
    const cb = wrap!.querySelector(".value-bool") as HTMLInputElement;
    expect(cb.type).toBe("checkbox");
    expect(cb.checked).toBe(true);
  });

  it("renders comma-placeholder text input for In operator on non-select column", () => {
    const c = makeContainer();
    const row: BasicRow = {
      column: "tags",
      operator: FilterOperator.In,
      value: "a, b, c",
    };
    renderValueWidget(c, stringCol, row);
    const inp = c.querySelector(".value-field") as HTMLInputElement;
    expect(inp.type).toBe("text");
    expect(inp.placeholder).toBe("value1, value2, …");
    expect(inp.value).toBe("a, b, c");
  });

  it("renders text input when colMeta is undefined", () => {
    const c = makeContainer();
    const row: BasicRow = {
      column: "unknown",
      operator: FilterOperator.Eq,
      value: "foo",
    };
    renderValueWidget(c, undefined, row);
    const inp = c.querySelector(".value-field") as HTMLInputElement;
    expect(inp.type).toBe("text");
    expect(inp.value).toBe("foo");
  });
});

// ---------------------------------------------------------------------------
// readValueFromRow
// ---------------------------------------------------------------------------

describe("readValueFromRow", () => {
  it("returns undefined for ALL", () => {
    const row = document.createElement("div");
    expect(readValueFromRow(row, "ALL")).toEqual({ value: undefined });
  });

  it("returns undefined for isNull", () => {
    const row = document.createElement("div");
    expect(readValueFromRow(row, FilterOperator.IsNull)).toEqual({
      value: undefined,
    });
  });

  it("reads between inputs", () => {
    const row = document.createElement("div");
    const from = document.createElement("input");
    from.className = "value-from";
    from.value = "10";
    const to = document.createElement("input");
    to.className = "value-to";
    to.value = "20";
    row.append(from, to);

    const result = readValueFromRow(row, FilterOperator.Between);
    expect(result).toEqual({ value: "10", valueTo: "20" });
  });

  it("reads multi-select checked values", () => {
    const row = document.createElement("div");
    for (const v of ["A", "B", "C"]) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "multi-check";
      cb.value = v;
      cb.checked = v !== "B";
      row.appendChild(cb);
    }
    const result = readValueFromRow(row, FilterOperator.In);
    expect(result).toEqual({ value: ["A", "C"] });
  });

  it("reads boolean toggle", () => {
    const row = document.createElement("div");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "value-bool";
    cb.checked = true;
    row.appendChild(cb);
    expect(readValueFromRow(row, FilterOperator.Eq)).toEqual({ value: true });
  });

  it("reads regular input value", () => {
    const row = document.createElement("div");
    const inp = document.createElement("input");
    inp.className = "value-field";
    inp.value = "hello";
    row.appendChild(inp);
    expect(readValueFromRow(row, FilterOperator.Eq)).toEqual({
      value: "hello",
    });
  });
});

// ---------------------------------------------------------------------------
// readConditionValue
// ---------------------------------------------------------------------------

describe("readConditionValue", () => {
  it("returns undefined for null operators", () => {
    const row = document.createElement("div");
    expect(readConditionValue(row, FilterOperator.IsNull)).toBeUndefined();
  });

  it("reads Between as array", () => {
    const row = document.createElement("div");
    const from = document.createElement("input");
    from.className = "value-from";
    from.value = "5";
    const to = document.createElement("input");
    to.className = "value-to";
    to.value = "15";
    row.append(from, to);
    expect(readConditionValue(row, FilterOperator.Between)).toEqual([
      "5",
      "15",
    ]);
  });

  it("reads In operator — splits comma-separated", () => {
    const row = document.createElement("div");
    const inp = document.createElement("input");
    inp.className = "value-field";
    inp.value = "a, b, c";
    row.appendChild(inp);
    expect(readConditionValue(row, FilterOperator.In)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("reads Eq operator — plain string", () => {
    const row = document.createElement("div");
    const inp = document.createElement("input");
    inp.className = "value-field";
    inp.value = "hello";
    row.appendChild(inp);
    expect(readConditionValue(row, FilterOperator.Eq)).toBe("hello");
  });
});

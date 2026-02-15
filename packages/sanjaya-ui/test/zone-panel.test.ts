// ---------------------------------------------------------------------------
// Tests for <sj-pivot-zone>
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ColumnMeta } from "../src/types/columns";
import { ColumnType } from "../src/types/columns";
import { AggFunc } from "../src/types/ssrm";
import type { ColumnVO } from "../src/types/ssrm";
import { FilterOperator } from "../src/types/filters";
import type {
  ZoneAddDetail,
  ZoneRemoveDetail,
  ZoneAggChangeDetail,
} from "../src/pivot-config/zone-panel/zone-panel";

import "../src/pivot-config/zone-panel/zone-panel.js";
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

const vo = (id: string, displayName?: string, aggFunc?: AggFunc): ColumnVO => ({
  id,
  displayName: displayName ?? id,
  field: id,
  ...(aggFunc !== undefined ? { aggFunc } : {}),
});

const ALL_META: ColumnMeta[] = [
  dimCol("region", "Region"),
  dimCol("year", "Year"),
  measCol("revenue", "Revenue"),
  measCol("cost", "Cost", [
    { agg: AggFunc.Sum, label: "Sum" },
    { agg: AggFunc.Min, label: "Min" },
    { agg: AggFunc.Max, label: "Max" },
  ]),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createElement(): SanjayaPivotZone {
  const el = document.createElement("sj-pivot-zone") as SanjayaPivotZone;
  document.body.appendChild(el);
  return el;
}

function getItems(el: SanjayaPivotZone): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>(".zone-item"),
  );
}

function getItemLabels(el: SanjayaPivotZone): string[] {
  return getItems(el).map(
    (li) => li.querySelector(".item-label")!.textContent ?? "",
  );
}

function getRemoveButtons(el: SanjayaPivotZone): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll<HTMLElement>(".btn-remove"),
  );
}

function getAddSelect(el: SanjayaPivotZone): HTMLSelectElement {
  return el.shadowRoot!.getElementById("add-select") as HTMLSelectElement;
}

function getCount(el: SanjayaPivotZone): string {
  return el.shadowRoot!.getElementById("zone-count")!.textContent ?? "";
}

function getTitle(el: SanjayaPivotZone): string {
  return el.shadowRoot!.getElementById("zone-title")!.textContent ?? "";
}

function getEmptyState(el: SanjayaPivotZone): HTMLElement {
  return el.shadowRoot!.getElementById("zone-empty")!;
}

function getAggSelects(el: SanjayaPivotZone): HTMLSelectElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll<HTMLSelectElement>(".agg-select"),
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("registration", () => {
  it("is registered as sj-pivot-zone", () => {
    expect(customElements.get("sj-pivot-zone")).toBe(SanjayaPivotZone);
  });

  it("creates an instance via document.createElement", () => {
    const el = document.createElement("sj-pivot-zone");
    expect(el).toBeInstanceOf(SanjayaPivotZone);
  });
});

// ---------------------------------------------------------------------------
// Zone title
// ---------------------------------------------------------------------------

describe("zone title", () => {
  it("defaults to 'Rows'", () => {
    const el = createElement();
    expect(getTitle(el)).toBe("Rows");
  });

  it("shows 'Columns' when zone is set", () => {
    const el = createElement();
    el.zone = "columns";
    expect(getTitle(el)).toBe("Columns");
  });

  it("shows 'Values' when zone is set", () => {
    const el = createElement();
    el.zone = "values";
    expect(getTitle(el)).toBe("Values");
  });
});

// ---------------------------------------------------------------------------
// Rendering items
// ---------------------------------------------------------------------------

describe("rendering items", () => {
  it("shows empty state when no items", () => {
    const el = createElement();
    el.items = [];
    expect(getEmptyState(el).hidden).toBe(false);
    expect(getItems(el)).toHaveLength(0);
  });

  it("renders item labels and hides empty state", () => {
    const el = createElement();
    el.items = [vo("region", "Region"), vo("year", "Year")];
    expect(getItemLabels(el)).toEqual(["Region", "Year"]);
    expect(getEmptyState(el).hidden).toBe(true);
  });

  it("updates count badge", () => {
    const el = createElement();
    el.items = [vo("region", "Region"), vo("year", "Year")];
    expect(getCount(el)).toBe("2");
  });

  it("re-renders when items change", () => {
    const el = createElement();
    el.items = [vo("a", "A")];
    expect(getItemLabels(el)).toEqual(["A"]);

    el.items = [vo("b", "B"), vo("c", "C")];
    expect(getItemLabels(el)).toEqual(["B", "C"]);
    expect(getCount(el)).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// AggFunc dropdown (values zone)
// ---------------------------------------------------------------------------

describe("AggFunc dropdown (values zone)", () => {
  it("does not render agg selects for dimension zone", () => {
    const el = createElement();
    el.zone = "rows";
    el.columnMeta = ALL_META;
    el.items = [vo("region", "Region")];
    expect(getAggSelects(el)).toHaveLength(0);
  });

  it("renders agg selects for values zone", () => {
    const el = createElement();
    el.zone = "values";
    el.columnMeta = ALL_META;
    el.items = [
      vo("revenue", "Revenue", AggFunc.Sum),
      vo("cost", "Cost", AggFunc.Sum),
    ];
    expect(getAggSelects(el)).toHaveLength(2);
  });

  it("populates agg options from column metadata allowedAggs", () => {
    const el = createElement();
    el.zone = "values";
    el.columnMeta = ALL_META;
    el.items = [vo("cost", "Cost", AggFunc.Sum)];

    const selects = getAggSelects(el);
    expect(selects).toHaveLength(1);
    const options = Array.from(selects[0].options).map((o) => o.value);
    expect(options).toEqual([AggFunc.Sum, AggFunc.Min, AggFunc.Max]);
  });

  it("sets the agg select value to the item aggFunc", () => {
    const el = createElement();
    el.zone = "values";
    el.columnMeta = ALL_META;
    el.items = [vo("cost", "Cost", AggFunc.Min)];

    const selects = getAggSelects(el);
    expect(selects[0].value).toBe(AggFunc.Min);
  });

  it("emits zone-agg-change when agg dropdown changes", () => {
    const el = createElement();
    el.zone = "values";
    el.columnMeta = ALL_META;
    el.items = [vo("cost", "Cost", AggFunc.Sum)];

    const handler = vi.fn();
    el.addEventListener("zone-agg-change", handler);

    const aggSel = getAggSelects(el)[0];
    aggSel.value = AggFunc.Max;
    aggSel.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).toHaveBeenCalledOnce();
    const detail = (handler.mock.calls[0][0] as CustomEvent<ZoneAggChangeDetail>)
      .detail;
    expect(detail.zone).toBe("values");
    expect(detail.colId).toBe("cost");
    expect(detail.aggFunc).toBe(AggFunc.Max);
  });
});

// ---------------------------------------------------------------------------
// Add column select
// ---------------------------------------------------------------------------

describe("add column select", () => {
  it("populates candidates in the add-select dropdown", () => {
    const el = createElement();
    el.candidates = [dimCol("region", "Region"), dimCol("year", "Year")];

    const sel = getAddSelect(el);
    // First option is placeholder
    expect(sel.options[0].value).toBe("");
    expect(sel.options[1].value).toBe("region");
    expect(sel.options[1].textContent).toBe("Region");
    expect(sel.options[2].value).toBe("year");
  });

  it("hides footer when no candidates", () => {
    const el = createElement();
    el.candidates = [];
    const footer = el.shadowRoot!.getElementById("zone-footer")!;
    expect(footer.hidden).toBe(true);
  });

  it("shows footer when candidates exist", () => {
    const el = createElement();
    el.candidates = [dimCol("region", "Region")];
    const footer = el.shadowRoot!.getElementById("zone-footer")!;
    expect(footer.hidden).toBe(false);
  });

  it("emits zone-add when a candidate is selected", () => {
    const el = createElement();
    el.zone = "rows";
    el.candidates = [dimCol("region", "Region")];

    const handler = vi.fn();
    el.addEventListener("zone-add", handler);

    const sel = getAddSelect(el);
    sel.value = "region";
    sel.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).toHaveBeenCalledOnce();
    const detail = (handler.mock.calls[0][0] as CustomEvent<ZoneAddDetail>)
      .detail;
    expect(detail.zone).toBe("rows");
    expect(detail.colId).toBe("region");
  });

  it("resets the add-select to placeholder after adding", () => {
    const el = createElement();
    el.zone = "columns";
    el.candidates = [dimCol("year", "Year")];

    const sel = getAddSelect(el);
    sel.value = "year";
    sel.dispatchEvent(new Event("change", { bubbles: true }));

    expect(sel.value).toBe("");
  });

  it("does not emit zone-add when placeholder is selected", () => {
    const el = createElement();
    el.candidates = [dimCol("region", "Region")];

    const handler = vi.fn();
    el.addEventListener("zone-add", handler);

    const sel = getAddSelect(el);
    sel.value = "";
    sel.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Remove button
// ---------------------------------------------------------------------------

describe("remove button", () => {
  it("renders a remove button per item", () => {
    const el = createElement();
    el.items = [vo("a", "A"), vo("b", "B")];
    expect(getRemoveButtons(el)).toHaveLength(2);
  });

  it("emits zone-remove when remove button is clicked", () => {
    const el = createElement();
    el.zone = "rows";
    el.items = [vo("region", "Region"), vo("year", "Year")];

    const handler = vi.fn();
    el.addEventListener("zone-remove", handler);

    const removeBtn = getRemoveButtons(el)[1]; // remove "year"
    removeBtn.click();

    expect(handler).toHaveBeenCalledOnce();
    const detail = (handler.mock.calls[0][0] as CustomEvent<ZoneRemoveDetail>)
      .detail;
    expect(detail.zone).toBe("rows");
    expect(detail.colId).toBe("year");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("lifecycle", () => {
  it("cleans up event listeners on disconnect", () => {
    const el = createElement();
    el.zone = "rows";
    el.candidates = [dimCol("x", "X")];
    el.items = [vo("a", "A")];

    const handler = vi.fn();
    el.addEventListener("zone-add", handler);
    el.addEventListener("zone-remove", handler);

    document.body.removeChild(el);

    // After disconnect, clicks and selects should not fire zone events
    const sel = getAddSelect(el);
    sel.value = "x";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    const removeBtn = getRemoveButtons(el)[0];
    removeBtn.click();
    expect(handler).not.toHaveBeenCalled();
  });
});

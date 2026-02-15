// ---------------------------------------------------------------------------
// Tests for report-builder/helpers.ts — pure functions, no DOM
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { FilterCombinator, FilterOperator } from "../src/types/filters";
import { emptyFilterGroup } from "../src/types/filters";
import { AggFunc } from "../src/types/ssrm";
import {
  DynamicReportAction,
  DynamicReportStatus,
} from "../src/types/reports";
import type { DynamicReport, DynamicReportDefinition } from "../src/types/reports";
import { emptyPivotConfig } from "../src/pivot-config/helpers";
import {
  emptyBuilderState,
  stateToDefinition,
  definitionToState,
  buildActionMenu,
  hasNonDefaultState,
  isReportDirty,
} from "../src/report-builder/helpers";
import type { ReportBuilderState } from "../src/report-builder/helpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeReport(
  overrides: Partial<DynamicReport> = {},
): DynamicReport {
  return {
    id: 1,
    title: "Test Report",
    description: "",
    status: DynamicReportStatus.Draft,
    createdBy: { id: "u1", name: "Alice" },
    createdAt: "2025-01-01T00:00:00Z",
    version: 1,
    tags: [],
    availableActions: [],
    ...overrides,
  };
}

function stateWith(
  overrides: Partial<ReportBuilderState>,
): ReportBuilderState {
  return { ...emptyBuilderState(), ...overrides };
}

// ---------------------------------------------------------------------------
// emptyBuilderState
// ---------------------------------------------------------------------------

describe("emptyBuilderState", () => {
  it("returns a blank state", () => {
    const s = emptyBuilderState();
    expect(s.datasetKey).toBeNull();
    expect(s.columns.columns).toEqual([]);
    expect(s.filter.combinator).toBe(FilterCombinator.And);
    expect(s.pivotConfig.rowGroupCols).toEqual([]);
  });

  it("returns distinct instances", () => {
    const a = emptyBuilderState();
    const b = emptyBuilderState();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// stateToDefinition
// ---------------------------------------------------------------------------

describe("stateToDefinition", () => {
  it("returns null when no dataset is selected", () => {
    expect(stateToDefinition(emptyBuilderState())).toBeNull();
  });

  it("builds a definition from state", () => {
    const state = stateWith({
      datasetKey: "sales",
      columns: {
        columns: [
          { name: "year", selected: true, isGroup: false, order: 0 },
          { name: "region", selected: true, isGroup: false, order: 1 },
          { name: "notes", selected: false, isGroup: false, order: 2 },
        ],
      },
    });
    const def = stateToDefinition(state);

    expect(def).not.toBeNull();
    expect(def!.datasetKey).toBe("sales");
    // Only selected columns, in order
    expect(def!.selectedColumns).toEqual(["year", "region"]);
  });

  it("includes pivot config when non-empty", () => {
    const state = stateWith({
      datasetKey: "sales",
      pivotConfig: {
        rowGroupCols: [{ id: "region", displayName: "Region", field: "region" }],
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
    });
    const def = stateToDefinition(state)!;
    expect(def.rowGroupCols).toHaveLength(1);
    expect(def.valueCols).toHaveLength(1);
    expect(def.pivotCols).toBeUndefined(); // empty → omitted
  });

  it("omits empty pivot arrays as undefined", () => {
    const state = stateWith({
      datasetKey: "sales",
      pivotConfig: emptyPivotConfig(),
    });
    const def = stateToDefinition(state)!;
    expect(def.rowGroupCols).toBeUndefined();
    expect(def.pivotCols).toBeUndefined();
    expect(def.valueCols).toBeUndefined();
  });

  it("respects column order when building selectedColumns", () => {
    const state = stateWith({
      datasetKey: "sales",
      columns: {
        columns: [
          { name: "b", selected: true, isGroup: false, order: 2 },
          { name: "a", selected: true, isGroup: false, order: 0 },
          { name: "c", selected: true, isGroup: false, order: 1 },
        ],
      },
    });
    const def = stateToDefinition(state)!;
    expect(def.selectedColumns).toEqual(["a", "c", "b"]);
  });
});

// ---------------------------------------------------------------------------
// definitionToState
// ---------------------------------------------------------------------------

describe("definitionToState", () => {
  it("hydrates state from a definition", () => {
    const def: DynamicReportDefinition = {
      datasetKey: "sales",
      selectedColumns: ["year", "region"],
      filter: {
        combinator: FilterCombinator.And,
        conditions: [
          { column: "year", operator: FilterOperator.Eq, value: 2024 },
        ],
      },
      rowGroupCols: [{ id: "region", displayName: "Region", field: "region" }],
      pivotCols: [],
      valueCols: [],
    };

    const state = definitionToState(def);
    expect(state.datasetKey).toBe("sales");
    expect(state.columns.columns).toHaveLength(2);
    expect(state.columns.columns[0].name).toBe("year");
    expect(state.columns.columns[0].selected).toBe(true);
    expect(state.filter.conditions).toHaveLength(1);
    expect(state.pivotConfig.rowGroupCols).toHaveLength(1);
  });

  it("defaults missing optional fields", () => {
    const def: DynamicReportDefinition = {
      datasetKey: "inventory",
      selectedColumns: [],
      filter: emptyFilterGroup(),
    };
    const state = definitionToState(def);
    expect(state.pivotConfig.rowGroupCols).toEqual([]);
    expect(state.pivotConfig.pivotCols).toEqual([]);
    expect(state.pivotConfig.valueCols).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// hasNonDefaultState
// ---------------------------------------------------------------------------

describe("hasNonDefaultState", () => {
  it("returns false for empty state", () => {
    expect(hasNonDefaultState(emptyBuilderState())).toBe(false);
  });

  it("returns true when dataset is set", () => {
    expect(
      hasNonDefaultState(stateWith({ datasetKey: "sales" })),
    ).toBe(true);
  });

  it("returns true when columns are configured", () => {
    expect(
      hasNonDefaultState(
        stateWith({
          columns: {
            columns: [
              { name: "a", selected: true, isGroup: false, order: 0 },
            ],
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns true when filter has conditions", () => {
    expect(
      hasNonDefaultState(
        stateWith({
          filter: {
            combinator: FilterCombinator.And,
            conditions: [
              { column: "x", operator: FilterOperator.Eq, value: 1 },
            ],
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns true when pivot config has values", () => {
    expect(
      hasNonDefaultState(
        stateWith({
          pivotConfig: {
            rowGroupCols: [{ id: "r", displayName: "R", field: "r" }],
            pivotCols: [],
            valueCols: [],
          },
        }),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isReportDirty
// ---------------------------------------------------------------------------

describe("isReportDirty", () => {
  it("returns false when state equals saved snapshot", () => {
    const state = stateWith({ datasetKey: "sales" });
    const saved = structuredClone(state);
    expect(isReportDirty(state, saved)).toBe(false);
  });

  it("returns true when state differs from saved snapshot", () => {
    const state = stateWith({ datasetKey: "sales" });
    const saved = stateWith({ datasetKey: "inventory" });
    expect(isReportDirty(state, saved)).toBe(true);
  });

  it("returns true for non-default state when no snapshot (unsaved report)", () => {
    const state = stateWith({ datasetKey: "sales" });
    expect(isReportDirty(state, null)).toBe(true);
  });

  it("returns false for empty state when no snapshot", () => {
    expect(isReportDirty(emptyBuilderState(), null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildActionMenu
// ---------------------------------------------------------------------------

describe("buildActionMenu", () => {
  it("returns client-only actions for unsaved report", () => {
    const items = buildActionMenu(null, false, true, true);
    const actions = items.map((i) => i.action);
    expect(actions).toContain("save");
    expect(actions).toContain("saveAs");
    expect(actions).toContain("reset");
    expect(actions).toContain("clearAll");
    expect(actions).toContain("export");
    // No server actions
    expect(actions).not.toContain("publish");
  });

  it("disables save when not dirty", () => {
    const items = buildActionMenu(null, false, true, true);
    const save = items.find((i) => i.action === "save")!;
    expect(save.enabled).toBe(false);
  });

  it("enables save when dirty and has dataset", () => {
    const items = buildActionMenu(null, true, true, true);
    const save = items.find((i) => i.action === "save")!;
    expect(save.enabled).toBe(true);
  });

  it("disables export when no dataset", () => {
    const items = buildActionMenu(null, false, false, false);
    const exp = items.find((i) => i.action === "export")!;
    expect(exp.enabled).toBe(false);
  });

  it("includes server actions when report has availableActions", () => {
    const report = makeReport({
      availableActions: [
        DynamicReportAction.Publish,
        DynamicReportAction.Delete,
      ],
    });
    const items = buildActionMenu(report, false, true, true);
    const actions = items.map((i) => i.action);
    expect(actions).toContain(DynamicReportAction.Publish);
    expect(actions).toContain(DynamicReportAction.Delete);
    // Unpublish is NOT in availableActions
    expect(actions).not.toContain(DynamicReportAction.Unpublish);
  });

  it("marks Delete as danger", () => {
    const report = makeReport({
      availableActions: [DynamicReportAction.Delete],
    });
    const items = buildActionMenu(report, false, true, true);
    const del = items.find((i) => i.action === DynamicReportAction.Delete)!;
    expect(del.danger).toBe(true);
  });

  it("changes saveAs label to 'Save As…' for saved reports", () => {
    const report = makeReport();
    const items = buildActionMenu(report, false, true, true);
    const saveAs = items.find((i) => i.action === "saveAs")!;
    expect(saveAs.label).toBe("Save As…");
  });

  it("uses 'Save As New…' for unsaved reports", () => {
    const items = buildActionMenu(null, false, true, true);
    const saveAs = items.find((i) => i.action === "saveAs")!;
    expect(saveAs.label).toBe("Save As New…");
  });
});

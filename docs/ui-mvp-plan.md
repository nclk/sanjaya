# Sanjaya UI — MVP Implementation Plan

> Reusable web-component report builder for the Sanjaya dynamic reporting
> platform. Zero-framework, Shadow DOM, CSS custom properties for theming.

## Architecture Overview

A suite of custom elements composable into a single
`<sanjaya-report-builder>` shell. The host application injects a
**data-access client** conforming to a published TypeScript interface; the
components never assume endpoint URLs, authentication strategy, or HTTP
library.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Host Application (React + MUI, Angular, vanilla, …)               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  <sanjaya-report-builder>                                      │  │
│  │  ┌──────────────┐ ┌──────────────────┐ ┌───────────────────┐  │  │
│  │  │ Dataset      │ │ Column           │ │ Filter            │  │  │
│  │  │ Picker       │ │ Selector         │ │ Builder           │  │  │
│  │  └──────────────┘ └──────────────────┘ └───────────────────┘  │  │
│  │  ┌──────────────────┐  ┌────────────────────────────────────┐ │  │
│  │  │ Pivot Config     │  │ Actions Menu + Dirty-state bar     │ │  │
│  │  └──────────────────┘  └────────────────────────────────────┘ │  │
│  └────────────────────────────────────┬───────────────────────────┘  │
│                                       │ SanjayaDataClient            │
│                    ┌──────────────────┴──────────────────┐           │
│                    │ Host-provided client implementation  │           │
│                    │ (openapi-fetch, hand-rolled, etc.)   │           │
│                    └─────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────┘
```

### Technology choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Component model | Custom Elements v1 + Shadow DOM | Zero-framework, works in any host |
| Package scope | `@pojagi/sanjaya-ui` | All published JS/TS packages use the `@pojagi` npm scope |
| Templating | `@pojagi/build-templates` | Author `.html` with full IDE support; compile to importable TS strings |
| Styling | CSS custom properties (`--sanjaya-*`) | Host restyles without touching internals; MUI theme mapping is trivial |
| Types | Hand-authored TS types (mirroring TypeSpec models) | No codegen dep; host can optionally derive their own from the published TypeSpec |
| Drag-and-drop | `@atlaskit/pragmatic-drag-and-drop` (~8 kB) | Framework-agnostic, mobile support, polished UX |
| AG Grid compat | `ag-grid-enterprise` **^32.0.0** | SSRM is an Enterprise feature; our types and `SanjayaDataClient` response shapes must match AG Grid 32's `IServerSideDatasource` contract |
| Build | `@pojagi/build-templates` → `tsc` → ESM output | Simple, auditable pipeline |
| Tests | `@web/test-runner` + Playwright | Real browser tests for custom elements |

---

## Package scaffold

```
packages/sanjaya-ui/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                     # public entry — re-exports all elements + types
│   ├── types/
│   │   ├── client.ts                # SanjayaDataClient interface
│   │   ├── columns.ts               # ColumnMeta, FormatHints, PivotOptions, …
│   │   ├── filters.ts               # FilterGroup, FilterCondition, operators
│   │   ├── datasets.ts              # DatasetSummary, DatasetCapabilities
│   │   ├── ssrm.ts                  # ColumnVO, SortModelItem, SSRMRequest/Response
│   │   ├── reports.ts               # DynamicReport, DynamicReportDefinition, actions
│   │   └── index.ts
│   ├── themes/
│   │   ├── light.css                # default light theme (sets all --sanjaya-* vars)
│   │   └── dark.css                 # default dark theme
│   ├── shared/
│   │   ├── state.ts                 # DirtyTracker, simple reactive store
│   │   └── events.ts               # typed CustomEvent helpers
│   ├── dataset-picker/
│   │   ├── dataset-picker.html      # template source
│   │   └── dataset-picker.ts        # <sanjaya-dataset-picker> element
│   ├── column-selector/
│   │   ├── column-selector.html
│   │   └── column-selector.ts       # <sanjaya-column-selector> element
│   ├── filter-builder/
│   │   ├── filter-builder.html
│   │   ├── filter-condition.html
│   │   ├── filter-group.html
│   │   └── filter-builder.ts        # <sanjaya-filter-builder> element
│   ├── pivot-config/
│   │   ├── pivot-config.html
│   │   ├── pivot-panel.html
│   │   └── pivot-config.ts          # <sanjaya-pivot-config> element
│   └── report-builder/
│       ├── report-builder.html
│       └── report-builder.ts        # <sanjaya-report-builder> orchestrator
└── test/
    ├── dataset-picker.test.ts
    ├── column-selector.test.ts
    ├── filter-builder.test.ts
    ├── pivot-config.test.ts
    └── report-builder.test.ts
```

---

## Phase 1 — Types, client interface, theming, shared utilities

### 1.1 `SanjayaDataClient` interface

The host implements this and passes it as a property on
`<sanjaya-report-builder>`. Methods map to the Sanjaya REST surface:

```ts
interface SanjayaDataClient {
  // Dataset operations
  listDatasets(): Promise<DatasetSummary[]>;
  getColumns(datasetKey: string): Promise<ColumnMeta[]>;

  // SSRM queries (the host decides URL, auth, headers)
  queryTable(datasetKey: string, request: TableSSRMRequest): Promise<SSRMResponse>;
  queryPivot(datasetKey: string, request: PivotSSRMRequest): Promise<SSRMResponse>;

  // Export (returns a download — host may open a new tab, return a Blob, etc.)
  exportData(datasetKey: string, request: ExportRequest): Promise<Blob | void>;

  // Report CRUD
  listReports(params?: ReportListParams): Promise<ReportListResponse>;
  getReport(reportId: string): Promise<DynamicReport>;
  createReport(payload: CreateReportRequest): Promise<DynamicReport>;
  updateReport(reportId: string, payload: UpdateReportRequest): Promise<DynamicReport>;
  performAction(reportId: string, action: DynamicReportAction, payload?: Record<string, unknown>): Promise<DynamicReport>;

  // Sharing
  listShares(reportId: string): Promise<ShareListResponse>;
  upsertUserShare(reportId: string, payload: UserShareRequest): Promise<void>;
  removeUserShare(reportId: string, userId: string): Promise<void>;
  upsertGroupShare(reportId: string, payload: GroupShareRequest): Promise<void>;
  removeGroupShare(reportId: string, groupId: string): Promise<void>;
}
```

The component validates that `client` is set before making any calls and
emits a clear error event if it is missing.

### 1.2 Hand-authored TS types

Slim types derived from the TypeSpec models. Published from the package
entry point so host apps can implement `SanjayaDataClient` without running
TypeSpec tooling themselves. Key types:

- `ColumnMeta`, `ColumnType`, `FormatHints`, `FormatHintKind`
- `CurrencyOptions`, `CurrencyMagnitude`
- `PivotOptions`, `PivotAggOption`, `AggFunc`
- `FilterGroup`, `FilterCondition`, `FilterOperator`, `FilterCombinator`,
  `FilterStyle`
- `DatasetSummary`, `DatasetCapabilities`
- `ColumnVO`, `SortModelItem`
- `TableSSRMRequest`, `PivotSSRMRequest`, `SSRMResponse`, `PivotResultColDef`
- `ExportRequest`, `ExportFormat`
- `DynamicReport`, `DynamicReportSummary`, `DynamicReportDefinition`,
  `DynamicReportAction`, `DynamicReportStatus`
- Report CRUD request/response types
- Share types

### 1.3 CSS custom-property surface

Every component's Shadow DOM references `--sanjaya-*` variables. The
package ships two importable theme files (`themes/light.css`,
`themes/dark.css`) that set all variables on `:root`. Hosts override any
subset.

Variable groups:

| Prefix | Purpose | Examples |
|--------|---------|---------|
| `--sanjaya-color-*` | Palette | `--sanjaya-color-primary`, `-surface`, `-on-surface`, `-error`, `-border` |
| `--sanjaya-color-*-hover` | Interactive states | `--sanjaya-color-primary-hover` |
| `--sanjaya-spacing-*` | Spacing scale | `--sanjaya-spacing-xs` through `-xl` |
| `--sanjaya-radius-*` | Border radii | `--sanjaya-radius-sm`, `-md`, `-lg` |
| `--sanjaya-font-*` | Typography | `--sanjaya-font-family`, `-size-sm`, `-size-md`, `-weight-bold` |
| `--sanjaya-elevation-*` | Shadows | `--sanjaya-elevation-1`, `-2`, `-3` |
| `--sanjaya-transition-*` | Motion | `--sanjaya-transition-fast`, `-normal` |

Default themes respect `prefers-color-scheme`. MUI hosts map their palette:

```ts
// React wrapper (thin)
const sanjayaVars = {
  '--sanjaya-color-primary': theme.palette.primary.main,
  '--sanjaya-color-surface': theme.palette.background.paper,
  '--sanjaya-color-on-surface': theme.palette.text.primary,
  '--sanjaya-color-border': theme.palette.divider,
  // …
};
```

### 1.4 Shared utilities

**`DirtyTracker<T>`** — generic class that holds `applied: T` and
`current: T`. Exposes `isDirty: boolean` (deep comparison), `apply()`,
`undo()`, and `reset(initial)`. Each panel component owns one tracker.

**`TypedEvent<T>`** — helper to dispatch `CustomEvent<T>` on the host
element and optionally invoke a callback prop.

**Callback + Event hybrid pattern:**

```ts
// Every component supports both patterns:
//   1. DOM event:   el.addEventListener('filter-change', handler)
//   2. Callback:    el.onFilterChange = handler

protected emit<T>(name: string, detail: T): void {
  this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  const cb = (this as any)[`on${capitalize(camelize(name))}`];
  if (typeof cb === 'function') cb(detail);
}
```

### 1.5 Deliverables

- [ ] Package scaffolded, builds with `build-templates` → `tsc`
- [ ] All TS types exported from entry point
- [ ] `SanjayaDataClient` interface finalized
- [ ] Light and dark theme CSS files
- [ ] `DirtyTracker` and event helpers with unit tests

---

## Phase 2 — `<sanjaya-dataset-picker>`

### Behavior

- On mount (or when `client` is set), calls `client.listDatasets()`.
- Renders a searchable single-select dropdown.
- User selects a dataset → updates internal state, marks panel dirty.
- "Apply" confirms the selection → emits `dataset-change` event with
  `{ key: string, label: string }`.
- "Undo" reverts to last-applied dataset.
- When the applied dataset changes, sibling panels reset (orchestrator
  responsibility).

### Attributes / properties

| Name | Type | Description |
|------|------|-------------|
| `client` | `SanjayaDataClient` | Injected by orchestrator |
| `value` | `string` | Currently applied dataset key |
| `onDatasetChange` | `(detail) => void` | Optional callback |

### Dirty state

`DirtyTracker<string | null>` — tracks selected key vs. applied key.

### 2.1 Deliverables

- [ ] Element registered as `sanjaya-dataset-picker`
- [ ] Searchable dropdown with keyboard navigation
- [ ] Apply / Undo controls
- [ ] Event + callback dispatch
- [ ] Tests: selection, search filtering, dirty state, undo

---

## Phase 3 — `<sanjaya-column-selector>`

### Behavior

- Receives `datasetKey` from orchestrator; calls `client.getColumns(key)`.
- Renders a reorderable checklist of columns. Each row shows:
  - Drag handle
  - Checkbox (selected / not selected)
  - Column label
  - `isGroup` toggle (switch) — marks the column as a row-group column
- Drag-and-drop reordering via `@atlaskit/pragmatic-drag-and-drop`.
- Columns with `pivotOptions.role === "measure"` cannot be toggled as
  `isGroup` (grayed out).

### Tracked state shape

```ts
interface ColumnSelection {
  columns: Array<{
    name: string;
    selected: boolean;
    isGroup: boolean;
    order: number;
  }>;
}
```

### Attributes / properties

| Name | Type | Description |
|------|------|-------------|
| `client` | `SanjayaDataClient` | Injected |
| `dataset-key` | `string` | Which dataset's columns to load |
| `value` | `ColumnSelection` | Current applied state |
| `onColumnsChange` | `(detail) => void` | Optional callback |

### Dirty state

`DirtyTracker<ColumnSelection>` — tracks order, selection, and group
toggles vs. last-applied state.

### 3.1 Deliverables

- [ ] Element registered as `sanjaya-column-selector`
- [ ] Drag-and-drop reordering (desktop + mobile)
- [ ] isGroup toggle with measure-column guard
- [ ] Select all / deselect all
- [ ] Apply / Undo controls
- [ ] Tests: reorder, toggle, dirty state, measure guard

---

## Phase 4 — `<sanjaya-filter-builder>`

### Two modes

Toggled via a `mode` attribute (`"basic"` | `"advanced"`):

#### Basic mode

- Flat list of conditions, no visible combinator (implicit AND).
- Each condition row: **Column** dropdown → **Operator** dropdown
  (defaults to "ALL" / pass-through) → **Value** input.
- Operator list driven by `ColumnMeta.operators` for the selected column.
- Value input adapts to column type:
  - `string` → text input
  - `number`, `currency`, `percentage` → number input
  - `date`, `datetime` → date/datetime picker
  - `boolean` → checkbox / toggle
  - `filterStyle: "select"` → multi-select from `ColumnMeta.enumValues`
  - `operator: "between"` → two value inputs
  - `operator: "in"` → comma-separated / tag input
  - `operator: "isNull"` / `"isNotNull"` → no value input
- Add / remove condition buttons.
- "ALL" pseudo-operator means "no filter on this column" — the condition
  is excluded from the emitted `FilterGroup`.

#### Advanced mode

- Full recursive `FilterGroup` tree editor.
- Each group has:
  - **Combinator** toggle: AND / OR
  - **NOT** toggle (negation at group level)
  - Nested conditions (same row UI as basic mode, plus per-condition NOT
    toggle)
  - Nested sub-groups (add group button)
  - Remove group button
- Root group is always present and cannot be removed.

### Emitted shape

Both modes emit a `FilterGroup` (the sanjaya-core format). Basic mode
produces:

```json
{
  "combinator": "and",
  "conditions": [ /* non-ALL conditions only */ ]
}
```

### Attributes / properties

| Name | Type | Description |
|------|------|-------------|
| `client` | `SanjayaDataClient` | Injected |
| `dataset-key` | `string` | For loading column metadata |
| `mode` | `"basic" \| "advanced"` | Filter mode (default: `"basic"`) |
| `value` | `FilterGroup` | Current applied filter |
| `onFilterChange` | `(detail) => void` | Optional callback |

### Dirty state

`DirtyTracker<FilterGroup>` — tracks current tree vs. last-applied tree.

### 4.1 Deliverables

- [ ] Element registered as `sanjaya-filter-builder`
- [ ] Basic mode: flat AND list with ALL default
- [ ] Advanced mode: recursive groups with AND/OR/NOT
- [ ] Operator-driven value input adaptation
- [ ] `filterStyle: "select"` renders multi-select from `enumValues`
- [ ] `between` renders two value inputs
- [ ] Apply / Undo controls
- [ ] Mode toggle (basic ↔ advanced) preserves compatible state
- [ ] Tests: both modes, operator adaptation, dirty state, serialization

---

## Phase 5 — `<sanjaya-pivot-config>`

### Behavior

- Enabled only when the active dataset's `capabilities.pivot` is `true`.
  Otherwise renders a disabled/hidden state with explanatory text.
- Three sub-panels, each a drop-target list:

| Panel | Purpose | Accepts | Maps to |
|-------|---------|---------|---------|
| **Rows** | Row-group dimensions | Columns with `pivotOptions.role === "dimension"` | `rowGroupCols` (as `ColumnVO[]`) |
| **Columns** | Pivot (cross-tab) dimensions | Columns with `pivotOptions.role === "dimension"` | `pivotCols` (as `ColumnVO[]`) |
| **Values** | Measures with agg function | Columns with `pivotOptions.role === "measure"` | `valueCols` (as `ColumnVO[]` with `aggFunc`) |

- **Values panel**: each dropped column shows an `AggFunc` dropdown
  constrained by that column's `pivotOptions.allowedAggs`. Defaults to the
  first allowed agg.
- Columns can be dragged between Rows and Columns panels (both accept
  dimensions). A column cannot appear in both Rows and Columns
  simultaneously.
- Drag-and-drop within panels controls ordering.

### Tracked state shape

```ts
interface PivotConfig {
  rowGroupCols: ColumnVO[];
  pivotCols: ColumnVO[];
  valueCols: ColumnVO[];   // each has aggFunc set
}
```

### Attributes / properties

| Name | Type | Description |
|------|------|-------------|
| `client` | `SanjayaDataClient` | Injected |
| `dataset-key` | `string` | For loading column metadata |
| `value` | `PivotConfig` | Current applied config |
| `disabled` | `boolean` | Set by orchestrator when pivot not supported |
| `onPivotConfigChange` | `(detail) => void` | Optional callback |

### Dirty state

`DirtyTracker<PivotConfig>` — tracks current layout vs. last-applied.

### 5.1 Deliverables

- [ ] Element registered as `sanjaya-pivot-config`
- [ ] Three sub-panels with drag-and-drop
- [ ] AggFunc picker constrained by `allowedAggs`
- [ ] Dimension exclusivity (Rows ↔ Columns, not both)
- [ ] Disabled state when `capabilities.pivot` is false
- [ ] Apply / Undo controls
- [ ] Tests: drag between panels, agg selection, disabled state, dirty state

---

## Phase 6 — `<sanjaya-report-builder>` orchestrator

### Responsibilities

1. **Compose** all child components into a coherent layout.
2. **Inject `client`** downward to all children.
3. **Coordinate data flow**: when dataset changes → reset columns, filters,
   pivot config; when columns load → update filter builder's column list
   and pivot config's available columns.
4. **Two-tier dirty state**:
   - **Panel-level**: each child tracks current vs. applied state. Panels
     show "Apply" / "Undo" buttons when dirty.
   - **Report-level**: any applied state differs from last-saved state →
     report is dirty. Enables "Save" in the Actions menu, shows an unsaved
     indicator.
5. **Actions menu**: dropdown driven by the report's `availableActions`
   from the server, plus client-only actions:

   | Action | Source | Enabled when |
   |--------|--------|-------------|
   | Save | client | Report is dirty (applied ≠ saved) |
   | Save As / Duplicate | client | Always (creates new report) |
   | Reset | client | Report is dirty |
   | Clear All | client | Any panel has non-default state |
   | Export As… | client → `client.exportData()` | Dataset selected |
   | Publish | server (`availableActions`) | Report is saved + action available |
   | Unpublish | server | Action available |
   | Archive | server | Action available |
   | Restore | server | Action available |
   | Share… | server | Action available |
   | Transfer Ownership | server | Action available |
   | Favorite | server | Action available (see backend addenda) |
   | Delete | server | Action available |

6. **`getReportDefinition()`** method — returns the current applied state
   as a `DynamicReportDefinition`-shaped object (extended with pivot
   config — see backend addenda).
7. **`report-definition-change`** event — emitted whenever applied state
   changes, so reactive host frameworks can bind to it.

### Attributes / properties

| Name | Type | Description |
|------|------|-------------|
| `client` | `SanjayaDataClient` | **Required.** Host-provided data client |
| `report-id` | `string` | Load an existing saved report on mount |
| `onReportDefinitionChange` | `(def) => void` | Optional callback |
| `onAction` | `(action, report) => void` | Optional callback for lifecycle actions |

### State management

The orchestrator maintains a simple reactive store (plain object +
`Proxy`-based change notification). State shape:

```ts
interface ReportBuilderState {
  datasetKey: string | null;
  columns: ColumnSelection;
  filter: FilterGroup;
  pivotConfig: PivotConfig;
  savedSnapshot: ReportBuilderState | null;  // last-saved state for diff
  report: DynamicReport | null;              // server-side report metadata
}
```

Flow:
1. Properties flow **down** (orchestrator → children via property assignment).
2. Events bubble **up** (children → orchestrator via `CustomEvent`).
3. On "Apply" in any panel → orchestrator updates its applied state →
   compares with `savedSnapshot` → updates report-level dirty indicator →
   emits `report-definition-change`.
4. On "Save" → orchestrator calls `client.createReport()` or
   `client.updateReport()` → on success, snapshots current state as
   `savedSnapshot` → clears report-level dirty.

### 6.1 Deliverables

- [ ] Element registered as `sanjaya-report-builder`
- [ ] All child components composed and wired
- [ ] Two-tier dirty state (panel + report level)
- [ ] Actions menu with enable/disable logic
- [ ] Save / load round-trip via `SanjayaDataClient`
- [ ] `getReportDefinition()` method
- [ ] `report-definition-change` event + callback
- [ ] Tests: state coordination, dirty transitions, save flow, action dispatch

---

## Phase 7 — Integration, documentation, and polish

### 7.1 React wrapper (optional, published separately or as sub-entry)

Target host environment: **React ^18.3.1**, **ag-grid-enterprise ^32.0.0**,
**ag-grid-react ^32.0.0**.

Thin React component that:
- Creates the custom element
- Forwards props → element properties
- Maps `on*` React props → element callbacks
- Applies MUI theme → `--sanjaya-*` CSS vars

### 7.2 Documentation

- README with installation, quick-start, and API reference.
- Theming guide (CSS variable catalog, MUI integration recipe).
- `SanjayaDataClient` implementation guide (including openapi-fetch recipe).
- Storybook-style live examples (or a lightweight demo page).

### 7.3 Deliverables

- [ ] React wrapper (if team confirms demand)
- [ ] README + theming guide
- [ ] Client implementation guide
- [ ] Demo page
- [ ] All component tests green

---

## Phasing summary

| Phase | Component | Key outcome |
|-------|-----------|-------------|
| **1** | Types + client + themes + utilities | Foundation: TS types, `SanjayaDataClient` interface, CSS theming, `DirtyTracker` |
| **2** | `<sanjaya-dataset-picker>` | Dataset selection with searchable dropdown |
| **3** | `<sanjaya-column-selector>` | Reorderable column list with isGroup toggle |
| **4** | `<sanjaya-filter-builder>` | Basic (flat AND) + Advanced (recursive groups) filter editing |
| **5** | `<sanjaya-pivot-config>` | Row / Column / Value zone builders with agg picker |
| **6** | `<sanjaya-report-builder>` | Orchestrator with two-tier dirty state + Actions menu |
| **7** | Integration + docs | React wrapper, theming guide, demo |

Each phase is independently testable. Phases 2–5 can be developed in
parallel once Phase 1 is complete.

---

## Dependencies on backend changes

Several features require additions to the backend API. These are detailed
in [`backend-addenda.md`](backend-addenda.md).

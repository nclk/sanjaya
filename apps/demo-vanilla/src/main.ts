// ---------------------------------------------------------------------------
// Sanjaya — vanilla TypeScript demo application bootstrap
// ---------------------------------------------------------------------------

// AG Grid enterprise (must be imported before createGrid is used)
import { createGrid, LicenseManager } from "ag-grid-enterprise";

// AG Grid styles — imported from JS so Vite's resolver handles pnpm's
// strict node_modules (ag-grid-community is a transitive dep).
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Sanjaya UI components + types (side-effect: registers custom elements)
import {
  SanjayaDatasetPicker,
  SanjayaColumnSelector,
  SanjayaFilterBuilder,
  SanjayaPivotConfig,
  SanjayaDataGrid,
  stateToDefinition,
  emptyBuilderState,
  emptyPivotConfig,
  emptyFilterGroup,
  type DatasetChangeDetail,
  type ColumnsChangeDetail,
  type FilterChangeDetail,
  type PivotConfigChangeDetail,
} from "@pojagi/sanjaya-ui";

// Fetch-based client for the Django demo server
import { client } from "./client";

// ---------------------------------------------------------------------------
// 1. AG Grid licence (dev — no key needed for evaluation)
// ---------------------------------------------------------------------------
// If you have a licence key, set it here:
// LicenseManager.setLicenseKey("YOUR_KEY");
void LicenseManager; // suppress unused-import warning in dev

// ---------------------------------------------------------------------------
// 2. Inject AG Grid factory into <sj-data-grid> globally
// ---------------------------------------------------------------------------
// The component declares a minimal `CreateGridFn` stand-in so it can compile
// without ag-grid-enterprise installed.  The real `createGrid` is a superset,
// so a cast is safe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
SanjayaDataGrid.createGrid = createGrid as any;

// ---------------------------------------------------------------------------
// 3. DOM references
// ---------------------------------------------------------------------------
const sidebar = document.getElementById("sidebar")!;
const tabButtons = sidebar.querySelectorAll<HTMLButtonElement>(".strip-tab");
const panels = sidebar.querySelectorAll<HTMLElement>(".panel[role='tabpanel']");
const resizeHandle = document.getElementById("resize-handle")!;

const picker = document.getElementById("dataset-picker") as unknown as SanjayaDatasetPicker;
const colSel = document.getElementById("column-selector") as unknown as SanjayaColumnSelector;
const filterEl = document.getElementById("filter-builder") as unknown as SanjayaFilterBuilder;
const pivotEl = document.getElementById("pivot-config") as unknown as SanjayaPivotConfig;
const grid = document.querySelector<SanjayaDataGrid>("sj-data-grid")!;

// ---------------------------------------------------------------------------
// 4. Inject the data client into every component
// ---------------------------------------------------------------------------
picker.client = client;
colSel.client = client;
filterEl.client = client;
pivotEl.client = client;
grid.client = client;

// ---------------------------------------------------------------------------
// 5. Builder state — mirrors what <sj-report-builder> tracks internally
// ---------------------------------------------------------------------------
const state = emptyBuilderState();

/** Push current state → grid as a DynamicReportDefinition. */
function syncGrid(): void {
  const def = stateToDefinition(state);
  if (def) {
    // Only set definition — its _onDefinitionChange handler manages
    // datasetKey internally and avoids a double-destroy race.
    grid.definition = def;
  }
}

// ---------------------------------------------------------------------------
// 6. Wire child-component events
// ---------------------------------------------------------------------------

// Dataset change → cascade key to the other 3 + reset state
picker.addEventListener("dataset-change", ((e: CustomEvent<DatasetChangeDetail>) => {
  const { key, capabilities } = e.detail;

  state.datasetKey = key;
  state.columns = { columns: [] };
  state.filter = emptyFilterGroup();
  state.pivotConfig = emptyPivotConfig();

  colSel.datasetKey = key;
  filterEl.datasetKey = key;
  pivotEl.datasetKey = key;
  pivotEl.disabled = !capabilities.pivot;

  syncGrid();
}) as EventListener);

// Columns change → store + sync
colSel.addEventListener("columns-change", ((e: CustomEvent<ColumnsChangeDetail>) => {
  state.columns = e.detail;
  syncGrid();
}) as EventListener);

// Filter change → store + sync
filterEl.addEventListener("filter-change", ((e: CustomEvent<FilterChangeDetail>) => {
  state.filter = e.detail;
  syncGrid();
}) as EventListener);

// Pivot config change → store + sync
pivotEl.addEventListener("pivot-config-change", ((e: CustomEvent<PivotConfigChangeDetail>) => {
  state.pivotConfig = e.detail;
  syncGrid();
}) as EventListener);

// ---------------------------------------------------------------------------
// 7. Sidebar tab switching (show one panel at a time)
// ---------------------------------------------------------------------------
function showPanel(panelId: string): void {
  for (const p of panels) {
    p.hidden = p.id !== panelId;
  }
}

for (const btn of tabButtons) {
  btn.addEventListener("click", () => {
    const panel = btn.dataset.panel!;
    const panelId = `panel-${panel}`;
    const wasSelected = btn.getAttribute("aria-selected") === "true";

    // Deselect all tabs
    for (const b of tabButtons) b.setAttribute("aria-selected", "false");

    if (wasSelected) {
      // Collapse sidebar
      sidebar.classList.remove("expanded");
      sidebar.classList.add("collapsed");
    } else {
      // Expand + show the selected panel
      btn.setAttribute("aria-selected", "true");
      sidebar.classList.remove("collapsed");
      sidebar.classList.add("expanded");
      showPanel(panelId);
    }
  });
}

// ---------------------------------------------------------------------------
// 8. Sidebar resize (drag handle)
// ---------------------------------------------------------------------------
let resizing = false;

resizeHandle.addEventListener("pointerdown", (e: PointerEvent) => {
  if (!sidebar.classList.contains("expanded")) return;

  resizing = true;
  resizeHandle.classList.add("dragging");
  resizeHandle.setPointerCapture(e.pointerId);

  const onMove = (ev: PointerEvent) => {
    if (!resizing) return;
    const width = Math.max(240, Math.min(ev.clientX, 600));
    sidebar.style.setProperty("--sidebar-width", `${width}px`);
  };

  const onUp = () => {
    resizing = false;
    resizeHandle.classList.remove("dragging");
    resizeHandle.removeEventListener("pointermove", onMove);
    resizeHandle.removeEventListener("pointerup", onUp);
    resizeHandle.removeEventListener("pointercancel", onUp);
  };

  resizeHandle.addEventListener("pointermove", onMove);
  resizeHandle.addEventListener("pointerup", onUp);
  resizeHandle.addEventListener("pointercancel", onUp);
});

// ---------------------------------------------------------------------------
// 9. Open the Dataset tab on first load
// ---------------------------------------------------------------------------
requestAnimationFrame(() => {
  const firstTab = tabButtons[0];
  if (firstTab) {
    firstTab.setAttribute("aria-selected", "true");
    sidebar.classList.remove("collapsed");
    sidebar.classList.add("expanded");
    showPanel("panel-dataset");
  }
});

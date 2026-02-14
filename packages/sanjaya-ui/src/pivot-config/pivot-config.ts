// ---------------------------------------------------------------------------
// <sj-pivot-config> — three-zone pivot layout editor
//
// Composes three <sj-pivot-zone> sub-components (Rows, Columns, Values).
// Manages DirtyTracker, column loading, and zone mutation in response to
// child zone events.
// ---------------------------------------------------------------------------

import type { SanjayaDataClient } from "../types/client.js";
import type { ColumnMeta } from "../types/columns.js";
import type { AggFunc } from "../types/ssrm.js";
import { DirtyTracker } from "../shared/state.js";
import { emit } from "../shared/events.js";
import { template } from "./template.js";

// Import sub-component (side-effect: registers custom element)
import "./zone-panel/zone-panel.js";
import type { SanjayaPivotZone } from "./zone-panel/zone-panel.js";
import type {
  ZoneAddDetail,
  ZoneRemoveDetail,
  ZoneReorderDetail,
  ZoneAggChangeDetail,
} from "./zone-panel/zone-panel.js";

import type { PivotConfig } from "./helpers.js";
import {
  emptyPivotConfig,
  columnVOFromMeta,
  unplacedDimensions,
  unplacedMeasures,
  addToZone,
  removeFromZone,
  reorderInZone,
  updateAggFunc,
} from "./helpers.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Detail payload for the `pivot-config-change` event. */
export type PivotConfigChangeDetail = PivotConfig;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-pivot-config>` — three-zone pivot layout editor.
 *
 * **Rows:** row-group dimension columns.
 * **Columns:** cross-tab pivot dimension columns.
 * **Values:** aggregated measure columns (each with an AggFunc).
 *
 * @fires pivot-config-change — Emitted when the user applies changes.
 *
 * @example
 * ```html
 * <sj-pivot-config></sj-pivot-config>
 * <script>
 *   const el = document.querySelector('sj-pivot-config');
 *   el.client = mySanjayaClient;
 *   el.datasetKey = 'sales';
 *   el.addEventListener('pivot-config-change', (e) => {
 *     console.log(e.detail);
 *   });
 * </script>
 * ```
 */
export class SanjayaPivotConfig extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  get client(): SanjayaDataClient | null {
    return this._client;
  }

  set client(value: SanjayaDataClient | null) {
    this._client = value;
    if (value && this._datasetKey) {
      this._loadColumns();
    }
  }

  get datasetKey(): string | null {
    return this._datasetKey;
  }

  set datasetKey(value: string | null) {
    if (value === this._datasetKey) return;
    this._datasetKey = value;
    if (value && this._client) {
      this._loadColumns();
    }
  }

  /** Whether pivot is disabled for the current dataset. */
  get disabled(): boolean {
    return this._disabled;
  }

  set disabled(value: boolean) {
    this._disabled = value;
    this._updateUI();
  }

  /** Currently applied pivot config (read-only from outside). */
  get value(): PivotConfig {
    return this._tracker.applied;
  }

  /** Optional callback — alternative to addEventListener. */
  onPivotConfigChange?: (detail: PivotConfigChangeDetail) => void;

  // ----- Private state ----------------------------------------------------

  private _client: SanjayaDataClient | null = null;
  private _datasetKey: string | null = null;
  private _columnMeta: ColumnMeta[] = [];
  private _disabled = false;
  private _tracker = new DirtyTracker<PivotConfig>(emptyPivotConfig());

  // Shadow DOM refs
  private _root: ShadowRoot;
  private _zonesEl: HTMLElement;
  private _zoneRows: SanjayaPivotZone;
  private _zoneCols: SanjayaPivotZone;
  private _zoneVals: SanjayaPivotZone;
  private _emptyState: HTMLElement;
  private _disabledState: HTMLElement;
  private _btnApply: HTMLButtonElement;
  private _btnUndo: HTMLButtonElement;
  private _dirtyDot: HTMLElement;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();

    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._zonesEl = this._root.getElementById("zones")!;
    this._zoneRows = this._root.getElementById(
      "zone-rows",
    ) as unknown as SanjayaPivotZone;
    this._zoneCols = this._root.getElementById(
      "zone-columns",
    ) as unknown as SanjayaPivotZone;
    this._zoneVals = this._root.getElementById(
      "zone-values",
    ) as unknown as SanjayaPivotZone;
    this._emptyState = this._root.getElementById("empty-state")!;
    this._disabledState = this._root.getElementById("disabled-state")!;
    this._btnApply = this._root.getElementById(
      "btn-apply",
    ) as HTMLButtonElement;
    this._btnUndo = this._root.getElementById(
      "btn-undo",
    ) as HTMLButtonElement;
    this._dirtyDot = this._root.getElementById("dirty-indicator")!;

    // Configure zone types
    this._zoneRows.zone = "rows";
    this._zoneCols.zone = "columns";
    this._zoneVals.zone = "values";
  }

  connectedCallback(): void {
    this._btnApply.addEventListener("click", this._onApply);
    this._btnUndo.addEventListener("click", this._onUndo);

    // Listen for zone intent events
    this._zoneRows.addEventListener("zone-add", this._onZoneAdd);
    this._zoneRows.addEventListener("zone-remove", this._onZoneRemove);
    this._zoneRows.addEventListener("zone-reorder", this._onZoneReorder);

    this._zoneCols.addEventListener("zone-add", this._onZoneAdd);
    this._zoneCols.addEventListener("zone-remove", this._onZoneRemove);
    this._zoneCols.addEventListener("zone-reorder", this._onZoneReorder);

    this._zoneVals.addEventListener("zone-add", this._onZoneAdd);
    this._zoneVals.addEventListener("zone-remove", this._onZoneRemove);
    this._zoneVals.addEventListener("zone-reorder", this._onZoneReorder);
    this._zoneVals.addEventListener(
      "zone-agg-change",
      this._onZoneAggChange,
    );

    if (this._client && this._datasetKey) {
      this._loadColumns();
    }
  }

  disconnectedCallback(): void {
    this._btnApply.removeEventListener("click", this._onApply);
    this._btnUndo.removeEventListener("click", this._onUndo);

    this._zoneRows.removeEventListener("zone-add", this._onZoneAdd);
    this._zoneRows.removeEventListener("zone-remove", this._onZoneRemove);
    this._zoneRows.removeEventListener("zone-reorder", this._onZoneReorder);

    this._zoneCols.removeEventListener("zone-add", this._onZoneAdd);
    this._zoneCols.removeEventListener("zone-remove", this._onZoneRemove);
    this._zoneCols.removeEventListener("zone-reorder", this._onZoneReorder);

    this._zoneVals.removeEventListener("zone-add", this._onZoneAdd);
    this._zoneVals.removeEventListener("zone-remove", this._onZoneRemove);
    this._zoneVals.removeEventListener("zone-reorder", this._onZoneReorder);
    this._zoneVals.removeEventListener(
      "zone-agg-change",
      this._onZoneAggChange,
    );
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Programmatically set the applied pivot config (e.g. when loading a
   * saved report). Does **not** emit an event.
   */
  setAppliedValue(config: PivotConfig): void {
    this._tracker.reset(config);
    this._syncZones();
    this._updateButtons();
  }

  /** Force a re-fetch of columns. */
  async refresh(): Promise<void> {
    await this._loadColumns();
  }

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  private async _loadColumns(): Promise<void> {
    if (!this._client || !this._datasetKey) return;

    try {
      this._columnMeta = await this._client.getColumns(this._datasetKey);
    } catch {
      this._columnMeta = [];
    }

    this._tracker.reset(emptyPivotConfig());

    // Push column metadata to zone panels
    this._zoneRows.columnMeta = this._columnMeta;
    this._zoneCols.columnMeta = this._columnMeta;
    this._zoneVals.columnMeta = this._columnMeta;

    this._syncZones();
    this._updateUI();
  }

  // -----------------------------------------------------------------------
  // Sync zone children from tracker state
  // -----------------------------------------------------------------------

  private _syncZones(): void {
    const config = this._tracker.current;

    this._zoneRows.items = config.rowGroupCols;
    this._zoneCols.items = config.pivotCols;
    this._zoneVals.items = config.valueCols;

    // Update candidate lists (unplaced columns)
    this._zoneRows.candidates = unplacedDimensions(
      this._columnMeta,
      config,
    );
    this._zoneCols.candidates = unplacedDimensions(
      this._columnMeta,
      config,
    );
    this._zoneVals.candidates = unplacedMeasures(
      this._columnMeta,
      config,
    );
  }

  // -----------------------------------------------------------------------
  // UI update
  // -----------------------------------------------------------------------

  private _updateUI(): void {
    const hasColumns = this._columnMeta.length > 0;

    if (this._disabled) {
      this._zonesEl.hidden = true;
      this._emptyState.hidden = true;
      this._disabledState.hidden = false;
    } else if (!hasColumns) {
      this._zonesEl.hidden = true;
      this._emptyState.hidden = false;
      this._disabledState.hidden = true;
    } else {
      this._zonesEl.hidden = false;
      this._emptyState.hidden = true;
      this._disabledState.hidden = true;
    }

    this._updateButtons();
  }

  private _updateButtons(): void {
    const dirty = this._tracker.isDirty;
    this._btnApply.disabled = !dirty;
    this._btnUndo.disabled = !dirty;
    this._dirtyDot.hidden = !dirty;
  }

  // -----------------------------------------------------------------------
  // Zone event handlers — mutate tracker, re-sync zones
  // -----------------------------------------------------------------------

  private _onZoneAdd = (e: Event): void => {
    const { zone, colId } = (e as CustomEvent<ZoneAddDetail>).detail;
    const meta = this._columnMeta.find((c) => c.name === colId);
    if (!meta) return;
    const vo = columnVOFromMeta(meta);
    this._tracker.current = addToZone(this._tracker.current, zone, vo);
    this._syncZones();
    this._updateButtons();
  };

  private _onZoneRemove = (e: Event): void => {
    const { zone, colId } = (e as CustomEvent<ZoneRemoveDetail>).detail;
    this._tracker.current = removeFromZone(
      this._tracker.current,
      zone,
      colId,
    );
    this._syncZones();
    this._updateButtons();
  };

  private _onZoneReorder = (e: Event): void => {
    const { zone, fromIdx, toIdx } = (
      e as CustomEvent<ZoneReorderDetail>
    ).detail;
    this._tracker.current = reorderInZone(
      this._tracker.current,
      zone,
      fromIdx,
      toIdx,
    );
    this._syncZones();
    this._updateButtons();
  };

  private _onZoneAggChange = (e: Event): void => {
    const { colId, aggFunc } = (
      e as CustomEvent<ZoneAggChangeDetail>
    ).detail;
    this._tracker.current = updateAggFunc(
      this._tracker.current,
      colId,
      aggFunc as AggFunc,
    );
    this._syncZones();
    this._updateButtons();
  };

  // -----------------------------------------------------------------------
  // Apply / Undo
  // -----------------------------------------------------------------------

  private _onApply = (): void => {
    const applied = this._tracker.apply();
    emit<PivotConfigChangeDetail>(this, "pivot-config-change", applied);
    this._updateButtons();
  };

  private _onUndo = (): void => {
    this._tracker.undo();
    this._syncZones();
    this._updateButtons();
  };
}

customElements.define("sj-pivot-config", SanjayaPivotConfig);

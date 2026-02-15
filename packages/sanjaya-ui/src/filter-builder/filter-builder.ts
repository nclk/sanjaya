// ---------------------------------------------------------------------------
// <sj-filter-builder> — two-mode filter editor orchestrator
//
// Composes <sj-filter-basic> and <sj-filter-advanced>, managing mode
// switching, Apply / Undo, DirtyTracker, and column loading.
// ---------------------------------------------------------------------------

import type { SanjayaDataClient } from "../types/client";
import type { ColumnMeta } from "../types/columns";
import { emptyFilterGroup } from "../types/filters";
import type { FilterGroup } from "../types/filters";
import { DirtyTracker } from "../shared/state";
import { emit } from "../shared/events";
import { template } from "./template";

// Import sub-components (side-effect: registers custom elements)
import "./basic/basic-mode.js";
import "./advanced/advanced-mode.js";
import type { SanjayaFilterBasic } from "./basic/basic-mode";
import type { SanjayaFilterAdvanced } from "./advanced/advanced-mode";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Detail payload for the `filter-change` event. */
export type FilterChangeDetail = FilterGroup;

/** Filter mode: basic flat list or advanced recursive tree. */
export type FilterMode = "basic" | "advanced";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-filter-builder>` — two-mode filter editor.
 *
 * **Basic mode:** flat AND list with an "ALL" pseudo-operator default.
 * **Advanced mode:** recursive FilterGroup tree with AND/OR/NOT.
 *
 * Both modes emit a `FilterGroup` on Apply.
 *
 * @fires filter-change — Emitted when the user applies filter changes.
 *
 * @example
 * ```html
 * <sj-filter-builder mode="basic"></sj-filter-builder>
 * <script>
 *   const el = document.querySelector('sj-filter-builder');
 *   el.client = mySanjayaClient;
 *   el.datasetKey = 'sales';
 *   el.addEventListener('filter-change', (e) => {
 *     console.log(e.detail);
 *   });
 * </script>
 * ```
 */
export class SanjayaFilterBuilder extends HTMLElement {
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

  get mode(): FilterMode {
    return this._mode;
  }

  set mode(value: FilterMode) {
    if (value === this._mode) return;
    this._switchMode(value);
  }

  /** Currently applied filter group (read-only from outside). */
  get value(): FilterGroup {
    return this._tracker.applied;
  }

  /** Optional callback — alternative to addEventListener. */
  onFilterChange?: (detail: FilterChangeDetail) => void;

  // ----- Private state ----------------------------------------------------

  private _client: SanjayaDataClient | null = null;
  private _datasetKey: string | null = null;
  private _columnMeta: ColumnMeta[] = [];
  private _mode: FilterMode = "basic";
  private _tracker = new DirtyTracker<FilterGroup>(emptyFilterGroup());

  // Shadow DOM element refs
  private _root: ShadowRoot;
  private _basicEl: SanjayaFilterBasic;
  private _advancedEl: SanjayaFilterAdvanced;
  private _emptyState: HTMLElement;
  private _btnApply: HTMLButtonElement;
  private _btnUndo: HTMLButtonElement;
  private _dirtyDot: HTMLElement;
  private _modeBtnBasic: HTMLButtonElement;
  private _modeBtnAdvanced: HTMLButtonElement;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();

    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._basicEl = this._root.getElementById(
      "basic-mode",
    ) as unknown as SanjayaFilterBasic;
    this._advancedEl = this._root.getElementById(
      "advanced-mode",
    ) as unknown as SanjayaFilterAdvanced;
    this._emptyState = this._root.getElementById("empty-state")!;
    this._btnApply = this._root.getElementById(
      "btn-apply",
    ) as HTMLButtonElement;
    this._btnUndo = this._root.getElementById(
      "btn-undo",
    ) as HTMLButtonElement;
    this._dirtyDot = this._root.getElementById("dirty-indicator")!;
    this._modeBtnBasic = this._root.getElementById(
      "mode-basic",
    ) as HTMLButtonElement;
    this._modeBtnAdvanced = this._root.getElementById(
      "mode-advanced",
    ) as HTMLButtonElement;
  }

  connectedCallback(): void {
    this._btnApply.addEventListener("click", this._onApply);
    this._btnUndo.addEventListener("click", this._onUndo);
    this._modeBtnBasic.addEventListener("click", this._onModeBasic);
    this._modeBtnAdvanced.addEventListener("click", this._onModeAdvanced);
    this._basicEl.addEventListener("filter-dirty", this._onChildDirty);
    this._advancedEl.addEventListener("filter-dirty", this._onChildDirty);

    if (this._client && this._datasetKey) {
      this._loadColumns();
    }
  }

  disconnectedCallback(): void {
    this._btnApply.removeEventListener("click", this._onApply);
    this._btnUndo.removeEventListener("click", this._onUndo);
    this._modeBtnBasic.removeEventListener("click", this._onModeBasic);
    this._modeBtnAdvanced.removeEventListener("click", this._onModeAdvanced);
    this._basicEl.removeEventListener("filter-dirty", this._onChildDirty);
    this._advancedEl.removeEventListener(
      "filter-dirty",
      this._onChildDirty,
    );
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Programmatically set the applied filter (e.g. when loading a saved
   * report). Does **not** emit an event.
   */
  setAppliedValue(filter: FilterGroup): void {
    this._tracker.reset(filter);
    this._syncChildrenFromTracker();
    this._updateUI();
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

    const initial = emptyFilterGroup();
    this._tracker.reset(initial);

    // Push columns to children
    this._basicEl.columns = this._columnMeta;
    this._advancedEl.columns = this._columnMeta;

    this._updateUI();
  }

  // -----------------------------------------------------------------------
  // Mode switching
  // -----------------------------------------------------------------------

  private _switchMode(newMode: FilterMode): void {
    this._mode = newMode;

    if (newMode === "basic") {
      // Load the current tracker state into basic mode
      this._basicEl.loadFilterGroup(this._tracker.current);
    } else {
      // Load the current tracker state into advanced mode
      this._advancedEl.loadFilterGroup(this._tracker.current);
    }

    this._updateUI();
  }

  // -----------------------------------------------------------------------
  // Sync children from tracker (after setAppliedValue or Undo)
  // -----------------------------------------------------------------------

  private _syncChildrenFromTracker(): void {
    const fg = this._tracker.current;
    if (this._mode === "basic") {
      this._basicEl.loadFilterGroup(fg);
    } else {
      this._advancedEl.loadFilterGroup(fg);
    }
  }

  // -----------------------------------------------------------------------
  // UI update
  // -----------------------------------------------------------------------

  private _updateUI(): void {
    // Mode visibility
    const isBasic = this._mode === "basic";
    (this._basicEl as unknown as HTMLElement).hidden = !isBasic;
    (this._advancedEl as unknown as HTMLElement).hidden = isBasic;
    this._modeBtnBasic.setAttribute("aria-pressed", String(isBasic));
    this._modeBtnAdvanced.setAttribute("aria-pressed", String(!isBasic));

    // Empty state
    if (this._columnMeta.length === 0) {
      this._emptyState.hidden = false;
      (this._basicEl as unknown as HTMLElement).hidden = true;
      (this._advancedEl as unknown as HTMLElement).hidden = true;
    } else {
      this._emptyState.hidden = true;
    }

    // Dirty buttons
    this._updateButtons();
  }

  private _updateButtons(): void {
    const dirty = this._tracker.isDirty;
    this._btnApply.disabled = !dirty;
    this._btnUndo.disabled = !dirty;
    this._dirtyDot.hidden = !dirty;
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  /** Child sub-component reports its state changed. */
  private _onChildDirty = (e: Event): void => {
    const detail = (e as CustomEvent<FilterGroup>).detail;
    this._tracker.current = detail;
    this._updateButtons();
  };

  private _onApply = (): void => {
    const applied = this._tracker.apply();
    emit<FilterChangeDetail>(this, "filter-change", applied);
    this._updateButtons();
  };

  private _onUndo = (): void => {
    this._tracker.undo();
    this._syncChildrenFromTracker();
    this._updateButtons();
  };

  private _onModeBasic = (): void => {
    this.mode = "basic";
  };

  private _onModeAdvanced = (): void => {
    this.mode = "advanced";
  };
}

// Register the custom element
customElements.define("sj-filter-builder", SanjayaFilterBuilder);

// ---------------------------------------------------------------------------
// <sj-column-selector> — reorderable column checklist with isGroup toggle
// ---------------------------------------------------------------------------

import type { SanjayaDataClient } from "../types/client.js";
import type { ColumnMeta } from "../types/columns.js";
import { DirtyTracker } from "../shared/state.js";
import { emit } from "../shared/events.js";
import { template } from "./template.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** State of a single column in the selector. */
export interface ColumnEntry {
  name: string;
  selected: boolean;
  isGroup: boolean;
  order: number;
}

/** The tracked / emitted value shape. */
export interface ColumnSelection {
  columns: ColumnEntry[];
}

/** Detail payload for the `columns-change` event. */
export type ColumnsChangeDetail = ColumnSelection;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptySelection(): ColumnSelection {
  return { columns: [] };
}

/** Build the initial ColumnSelection from column metadata. */
function selectionFromMeta(columns: ColumnMeta[]): ColumnSelection {
  return {
    columns: columns.map((c, i) => ({
      name: c.name,
      selected: true,
      isGroup: false,
      order: i,
    })),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-column-selector>` — reorderable checklist of dataset columns.
 *
 * Each row shows a drag handle, a checkbox (selected/not), the column
 * label, and an isGroup toggle. Columns whose `pivotOptions.role` is
 * `"measure"` cannot be toggled as group columns.
 *
 * @fires columns-change — Emitted when the user applies changes.
 *
 * @example
 * ```html
 * <sj-column-selector></sj-column-selector>
 * <script>
 *   const el = document.querySelector('sj-column-selector');
 *   el.client = mySanjayaClient;
 *   el.datasetKey = 'sales';
 *   el.addEventListener('columns-change', (e) => {
 *     console.log(e.detail.columns);
 *   });
 * </script>
 * ```
 */
export class SanjayaColumnSelector extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  /** The host-provided data client. */
  get client(): SanjayaDataClient | null {
    return this._client;
  }

  set client(value: SanjayaDataClient | null) {
    this._client = value;
    if (value && this._datasetKey) {
      this._loadColumns();
    }
  }

  /** Which dataset's columns to load. */
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

  /** Currently applied column selection (read-only from outside). */
  get value(): ColumnSelection {
    return this._tracker.applied;
  }

  /** Optional callback — alternative to addEventListener. */
  onColumnsChange?: (detail: ColumnsChangeDetail) => void;

  // ----- Private state ----------------------------------------------------

  private _client: SanjayaDataClient | null = null;
  private _datasetKey: string | null = null;
  private _columnMeta: ColumnMeta[] = [];
  private _tracker = new DirtyTracker<ColumnSelection>(emptySelection());

  /** Currently dragged item index (null when not dragging). */
  private _dragIdx: number | null = null;

  // Shadow DOM element refs (assigned in constructor)
  private _root: ShadowRoot;
  private _listEl: HTMLUListElement;
  private _selectAllEl: HTMLInputElement;
  private _columnCountEl: HTMLElement;
  private _emptyState: HTMLElement;
  private _emptyMessage: HTMLElement;
  private _btnApply: HTMLButtonElement;
  private _btnUndo: HTMLButtonElement;
  private _dirtyDot: HTMLElement;
  private _itemTpl: HTMLTemplateElement;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();

    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._listEl = this._root.getElementById("column-list") as HTMLUListElement;
    this._selectAllEl = this._root.getElementById("select-all") as HTMLInputElement;
    this._columnCountEl = this._root.getElementById("column-count") as HTMLElement;
    this._emptyState = this._root.getElementById("empty-state") as HTMLElement;
    this._emptyMessage = this._root.getElementById("empty-message") as HTMLElement;
    this._btnApply = this._root.getElementById("btn-apply") as HTMLButtonElement;
    this._btnUndo = this._root.getElementById("btn-undo") as HTMLButtonElement;
    this._dirtyDot = this._root.getElementById("dirty-indicator") as HTMLElement;
    this._itemTpl = this._root.getElementById("column-item-tpl") as HTMLTemplateElement;
  }

  connectedCallback(): void {
    this._listEl.addEventListener("change", this._onListChange);
    this._listEl.addEventListener("keydown", this._onItemKeydown);
    this._selectAllEl.addEventListener("change", this._onSelectAll);
    this._btnApply.addEventListener("click", this._onApply);
    this._btnUndo.addEventListener("click", this._onUndo);

    // Drag-and-drop via native HTML5 DnD (works on desktop; mobile
    // enhancement via @atlaskit/pragmatic-drag-and-drop deferred to
    // integration phase)
    this._listEl.addEventListener("dragstart", this._onDragStart);
    this._listEl.addEventListener("dragover", this._onDragOver);
    this._listEl.addEventListener("dragleave", this._onDragLeave);
    this._listEl.addEventListener("drop", this._onDrop);
    this._listEl.addEventListener("dragend", this._onDragEnd);

    if (this._client && this._datasetKey) {
      this._loadColumns();
    }
  }

  disconnectedCallback(): void {
    this._listEl.removeEventListener("change", this._onListChange);
    this._listEl.removeEventListener("keydown", this._onItemKeydown);
    this._selectAllEl.removeEventListener("change", this._onSelectAll);
    this._btnApply.removeEventListener("click", this._onApply);
    this._btnUndo.removeEventListener("click", this._onUndo);
    this._listEl.removeEventListener("dragstart", this._onDragStart);
    this._listEl.removeEventListener("dragover", this._onDragOver);
    this._listEl.removeEventListener("dragleave", this._onDragLeave);
    this._listEl.removeEventListener("drop", this._onDrop);
    this._listEl.removeEventListener("dragend", this._onDragEnd);
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Programmatically set the applied value (e.g. when loading a saved
   * report). Does **not** emit an event.
   */
  setAppliedValue(selection: ColumnSelection): void {
    this._tracker.reset(selection);
    this._render();
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

    // Build initial selection — all columns selected, none grouped
    const initial = selectionFromMeta(this._columnMeta);
    this._tracker.reset(initial);
    this._render();
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private _render(): void {
    if (!this._listEl) return;

    const { columns } = this._tracker.current;

    // Sort by order for display
    const sorted = [...columns].sort((a, b) => a.order - b.order);

    this._listEl.innerHTML = "";

    for (const col of sorted) {
      const meta = this._columnMeta.find((m) => m.name === col.name);
      const isMeasure = meta?.pivot?.role === "measure";

      const li = this._itemTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      li.dataset.name = col.name;
      li.setAttribute("draggable", "true");

      // Selected checkbox
      const check = li.querySelector(".column-check") as HTMLInputElement;
      check.checked = col.selected;

      // Label
      li.querySelector(".column-label")!.textContent = meta?.label ?? col.name;

      // isGroup toggle
      const groupCheck = li.querySelector(".group-check") as HTMLInputElement;
      groupCheck.checked = col.isGroup;
      groupCheck.disabled = isMeasure;
      if (isMeasure) {
        groupCheck.title = "Measure columns cannot be used as row groups";
      }

      this._listEl.appendChild(li);
    }

    // Empty state
    if (columns.length === 0) {
      this._emptyMessage.textContent = "No columns available";
      this._emptyState.hidden = false;
      this._listEl.hidden = true;
    } else {
      this._emptyState.hidden = true;
      this._listEl.hidden = false;
    }

    // Column count
    const selectedCount = columns.filter((c) => c.selected).length;
    this._columnCountEl.textContent = `${selectedCount} / ${columns.length}`;

    // Select-all checkbox state
    this._selectAllEl.checked = columns.length > 0 && selectedCount === columns.length;
    this._selectAllEl.indeterminate =
      selectedCount > 0 && selectedCount < columns.length;

    this._updateButtons();
  }

  private _updateButtons(): void {
    const dirty = this._tracker.isDirty;
    this._btnApply.disabled = !dirty;
    this._btnUndo.disabled = !dirty;
    this._dirtyDot.hidden = !dirty;
  }

  // -----------------------------------------------------------------------
  // Mutators (update tracker.current, then re-render)
  // -----------------------------------------------------------------------

  private _toggleSelected(name: string, checked: boolean): void {
    const cols = structuredClone(this._tracker.current.columns);
    const col = cols.find((c) => c.name === name);
    if (col) {
      col.selected = checked;
      // Deselecting also ungroups
      if (!checked) col.isGroup = false;
      this._tracker.current = { columns: cols };
      this._render();
    }
  }

  private _toggleGroup(name: string, checked: boolean): void {
    const cols = structuredClone(this._tracker.current.columns);
    const col = cols.find((c) => c.name === name);
    if (col) {
      col.isGroup = checked;
      this._tracker.current = { columns: cols };
      this._render();
    }
  }

  private _setAllSelected(checked: boolean): void {
    const cols = structuredClone(this._tracker.current.columns);
    for (const col of cols) {
      col.selected = checked;
      if (!checked) col.isGroup = false;
    }
    this._tracker.current = { columns: cols };
    this._render();
  }

  private _moveColumn(fromIdx: number, toIdx: number): void {
    if (fromIdx === toIdx) return;
    const cols = structuredClone(this._tracker.current.columns);
    const sorted = [...cols].sort((a, b) => a.order - b.order);
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    // Reassign order values
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].order = i;
    }
    this._tracker.current = { columns: sorted };
    this._render();
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onListChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    const li = target.closest<HTMLElement>(".column-item");
    if (!li?.dataset.name) return;

    if (target.classList.contains("column-check")) {
      this._toggleSelected(li.dataset.name, target.checked);
    } else if (target.classList.contains("group-check")) {
      this._toggleGroup(li.dataset.name, target.checked);
    }
  };

  private _onSelectAll = (): void => {
    this._setAllSelected(this._selectAllEl.checked);
  };

  private _onItemKeydown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    const li = target.closest<HTMLElement>(".column-item");
    if (!li) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = li.nextElementSibling as HTMLElement | null;
        next?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = li.previousElementSibling as HTMLElement | null;
        prev?.focus();
        break;
      }
    }
  };

  private _onApply = (): void => {
    const applied = this._tracker.apply();
    emit<ColumnsChangeDetail>(this, "columns-change", applied);
    this._render();
  };

  private _onUndo = (): void => {
    this._tracker.undo();
    this._render();
  };

  // -----------------------------------------------------------------------
  // Native HTML5 drag-and-drop
  // -----------------------------------------------------------------------

  private _getItemIndex(el: HTMLElement): number {
    const items = Array.from(this._listEl.children);
    return items.indexOf(el);
  }

  private _onDragStart = (e: DragEvent): void => {
    const li = (e.target as HTMLElement).closest<HTMLElement>(".column-item");
    if (!li) return;
    this._dragIdx = this._getItemIndex(li);
    li.classList.add("dragging");
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", String(this._dragIdx));
  };

  private _onDragOver = (e: DragEvent): void => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";

    const li = (e.target as HTMLElement).closest<HTMLElement>(".column-item");
    if (!li) return;

    // Clear previous indicators
    for (const child of this._listEl.children) {
      child.classList.remove("drag-over-top", "drag-over-bottom");
    }

    // Show drop indicator
    const rect = li.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      li.classList.add("drag-over-top");
    } else {
      li.classList.add("drag-over-bottom");
    }
  };

  private _onDragLeave = (e: DragEvent): void => {
    const li = (e.target as HTMLElement).closest<HTMLElement>(".column-item");
    if (li) {
      li.classList.remove("drag-over-top", "drag-over-bottom");
    }
  };

  private _onDrop = (e: DragEvent): void => {
    e.preventDefault();
    const li = (e.target as HTMLElement).closest<HTMLElement>(".column-item");
    if (!li || this._dragIdx === null) return;

    // Clear indicators
    for (const child of this._listEl.children) {
      child.classList.remove("drag-over-top", "drag-over-bottom");
    }

    let toIdx = this._getItemIndex(li);
    const rect = li.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY >= midY) {
      toIdx += 1;
    }

    // Adjust if dropping after the original position
    if (toIdx > this._dragIdx) {
      toIdx -= 1;
    }

    this._moveColumn(this._dragIdx, toIdx);
    this._dragIdx = null;
  };

  private _onDragEnd = (): void => {
    this._dragIdx = null;
    for (const child of this._listEl.children) {
      child.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
    }
  };
}

// Register the custom element
customElements.define("sj-column-selector", SanjayaColumnSelector);

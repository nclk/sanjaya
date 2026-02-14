// ---------------------------------------------------------------------------
// <sj-dataset-picker> — searchable single-select dataset dropdown
// ---------------------------------------------------------------------------

import type { SanjayaDataClient } from "../types/client.js";
import type { DatasetSummary } from "../types/datasets.js";
import { DirtyTracker } from "../shared/state.js";
import { emit } from "../shared/events.js";
import { template } from "./template.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

/** Detail payload for the `dataset-change` event. */
export interface DatasetChangeDetail {
  key: string;
  label: string;
  capabilities: DatasetSummary["capabilities"];
}

/**
 * `<sj-dataset-picker>` — a searchable single-select panel that
 * lists registered datasets and lets the user pick one.
 *
 * @fires dataset-change — Emitted when the user applies a selection.
 *
 * @example
 * ```html
 * <sj-dataset-picker></sj-dataset-picker>
 * <script>
 *   const el = document.querySelector('sj-dataset-picker');
 *   el.client = mySanjayaClient;
 *   el.addEventListener('dataset-change', (e) => {
 *     console.log(e.detail.key);
 *   });
 * </script>
 * ```
 */
export class SanjayaDatasetPicker extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  /** The host-provided data client. Setting this triggers a fetch. */
  get client(): SanjayaDataClient | null {
    return this._client;
  }

  set client(value: SanjayaDataClient | null) {
    this._client = value;
    if (value) {
      this._loadDatasets();
    }
  }

  /** Currently applied dataset key (read-only from outside). */
  get value(): string | null {
    return this._tracker.applied;
  }

  /** Optional callback — alternative to addEventListener. */
  onDatasetChange?: (detail: DatasetChangeDetail) => void;

  // ----- Private state ----------------------------------------------------

  private _client: SanjayaDataClient | null = null;
  private _datasets: DatasetSummary[] = [];
  private _tracker = new DirtyTracker<string | null>(null);
  private _searchQuery = "";

  // Shadow DOM element refs (assigned in constructor)
  private _root: ShadowRoot;
  private _listEl: HTMLUListElement;
  private _searchEl: HTMLInputElement;
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

    // Attach shadow root and stamp template
    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    // Grab refs
    this._listEl = this._root.getElementById("dataset-list") as HTMLUListElement;
    this._searchEl = this._root.getElementById("search") as HTMLInputElement;
    this._emptyState = this._root.getElementById("empty-state") as HTMLElement;
    this._emptyMessage = this._root.getElementById("empty-message") as HTMLElement;
    this._btnApply = this._root.getElementById("btn-apply") as HTMLButtonElement;
    this._btnUndo = this._root.getElementById("btn-undo") as HTMLButtonElement;
    this._dirtyDot = this._root.getElementById("dirty-indicator") as HTMLElement;
    this._itemTpl = this._root.getElementById("dataset-item-tpl") as HTMLTemplateElement;
  }

  connectedCallback(): void {
    // Bind events
    this._searchEl.addEventListener("input", this._onSearch);
    this._listEl.addEventListener("click", this._onItemClick);
    this._listEl.addEventListener("keydown", this._onItemKeydown);
    this._btnApply.addEventListener("click", this._onApply);
    this._btnUndo.addEventListener("click", this._onUndo);

    // If client was set before we connected, fetch now
    if (this._client) {
      this._loadDatasets();
    }
  }

  disconnectedCallback(): void {
    this._searchEl?.removeEventListener("input", this._onSearch);
    this._listEl?.removeEventListener("click", this._onItemClick);
    this._listEl?.removeEventListener("keydown", this._onItemKeydown);
    this._btnApply?.removeEventListener("click", this._onApply);
    this._btnUndo?.removeEventListener("click", this._onUndo);
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Programmatically set the applied value (e.g. when loading a saved
   * report). Does **not** emit an event.
   */
  setAppliedValue(key: string | null): void {
    this._tracker.reset(key);
    this._render();
  }

  /** Force a re-fetch of the dataset list. */
  async refresh(): Promise<void> {
    await this._loadDatasets();
  }

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  private async _loadDatasets(): Promise<void> {
    if (!this._client) return;

    try {
      this._datasets = await this._client.listDatasets();
    } catch {
      this._datasets = [];
    }

    this._render();
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private _render(): void {
    if (!this._listEl) return;

    const query = this._searchQuery.toLowerCase();
    const filtered = query
      ? this._datasets.filter(
          (d) =>
            d.label.toLowerCase().includes(query) ||
            d.key.toLowerCase().includes(query) ||
            d.description.toLowerCase().includes(query),
        )
      : this._datasets;

    // Build list items by cloning the item template
    this._listEl.innerHTML = "";
    for (const ds of filtered) {
      const li = this._itemTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      li.dataset.key = ds.key;
      li.setAttribute(
        "aria-selected",
        ds.key === this._tracker.current ? "true" : "false",
      );

      li.querySelector(".dataset-item-name")!.textContent = ds.label;

      const badge = li.querySelector(".dataset-item-badge") as HTMLElement;
      badge.hidden = !ds.capabilities.pivot;

      const desc = li.querySelector(".dataset-item-desc") as HTMLElement;
      if (ds.description) {
        desc.textContent = ds.description;
      } else {
        desc.remove();
      }

      this._listEl.appendChild(li);
    }

    // Empty state
    if (this._datasets.length === 0) {
      this._emptyMessage.textContent = "No datasets available";
      this._emptyState.hidden = false;
      this._listEl.hidden = true;
    } else if (filtered.length === 0) {
      this._emptyMessage.textContent = "No datasets match your search";
      this._emptyState.hidden = false;
      this._listEl.hidden = true;
    } else {
      this._emptyState.hidden = true;
      this._listEl.hidden = false;
    }

    // Button / dirty state
    this._updateButtons();
  }

  private _updateButtons(): void {
    if (!this._btnApply) return;
    const dirty = this._tracker.isDirty;
    this._btnApply.disabled = !dirty;
    this._btnUndo.disabled = !dirty;
    this._dirtyDot.hidden = !dirty;
  }

  // -----------------------------------------------------------------------
  // Event handlers (arrow functions to preserve `this`)
  // -----------------------------------------------------------------------

  private _onSearch = (): void => {
    this._searchQuery = this._searchEl.value;
    this._render();
  };

  private _onItemClick = (e: Event): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(".dataset-item");
    if (!target?.dataset.key) return;
    this._selectKey(target.dataset.key);
  };

  private _onItemKeydown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("dataset-item")) return;

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (target.dataset.key) {
          this._selectKey(target.dataset.key);
        }
        break;
      case "ArrowDown": {
        e.preventDefault();
        const next = target.nextElementSibling as HTMLElement | null;
        next?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = target.previousElementSibling as HTMLElement | null;
        prev?.focus();
        break;
      }
    }
  };

  private _onApply = (): void => {
    const key = this._tracker.apply();
    if (key) {
      const ds = this._datasets.find((d) => d.key === key);
      if (ds) {
        emit<DatasetChangeDetail>(this, "dataset-change", {
          key: ds.key,
          label: ds.label,
          capabilities: ds.capabilities,
        });
      }
    }
    this._render();
  };

  private _onUndo = (): void => {
    this._tracker.undo();
    this._render();
    // Refocus the search so user can continue working
    this._searchEl?.focus();
  };

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private _selectKey(key: string): void {
    this._tracker.current = key;
    this._render();
  }
}

// Register the custom element
customElements.define("sj-dataset-picker", SanjayaDatasetPicker);

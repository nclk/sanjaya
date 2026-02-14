// ---------------------------------------------------------------------------
// <sj-pivot-zone> — single drop-zone panel for pivot configuration
//
// Reusable for Rows, Columns, and Values zones.  Renders a list of
// ColumnVOs with drag-and-drop reordering, a remove button per item,
// and an "Add column" selector showing unplaced candidates.
//
// The Values variant also renders an AggFunc dropdown per item.
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "../../types/columns.js";
import type { ColumnVO } from "../../types/ssrm.js";
import { AggFunc } from "../../types/ssrm.js";
import { emit } from "../../shared/events.js";
import { template } from "./template.js";
import type { PivotZone } from "../helpers.js";
import { AGG_LABELS } from "../helpers.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Event detail types
// ---------------------------------------------------------------------------

export interface ZoneAddDetail {
  zone: PivotZone;
  colId: string;
}

export interface ZoneRemoveDetail {
  zone: PivotZone;
  colId: string;
}

export interface ZoneReorderDetail {
  zone: PivotZone;
  fromIdx: number;
  toIdx: number;
}

export interface ZoneAggChangeDetail {
  zone: PivotZone;
  colId: string;
  aggFunc: AggFunc;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-pivot-zone>` — a single drop zone for the pivot layout.
 *
 * Emits intent events to the parent `<sj-pivot-config>` — it does **not**
 * own state. The parent mutates the PivotConfig and pushes updated
 * properties back down.
 *
 * @fires zone-add      — User selected a column from the "Add" dropdown.
 * @fires zone-remove   — User clicked the remove button on an item.
 * @fires zone-reorder  — User reordered items via drag-and-drop.
 * @fires zone-agg-change — User changed the aggregate function (values zone).
 */
export class SanjayaPivotZone extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  /** Which zone this panel represents. */
  get zone(): PivotZone {
    return this._zone;
  }

  set zone(value: PivotZone) {
    this._zone = value;
    this._titleEl.textContent = this._zoneLabel();
  }

  /** The columns currently placed in this zone. */
  get items(): ColumnVO[] {
    return this._items;
  }

  set items(value: ColumnVO[]) {
    this._items = value;
    this._render();
  }

  /** Candidate columns that can be added (unplaced). */
  get candidates(): ColumnMeta[] {
    return this._candidates;
  }

  set candidates(value: ColumnMeta[]) {
    this._candidates = value;
    this._renderAddSelect();
  }

  /**
   * Full column metadata list — used to look up `allowedAggs` for the
   * values zone's AggFunc dropdown.
   */
  get columnMeta(): ColumnMeta[] {
    return this._columnMeta;
  }

  set columnMeta(value: ColumnMeta[]) {
    this._columnMeta = value;
  }

  // ----- Internal state ---------------------------------------------------

  private _zone: PivotZone = "rows";
  private _items: ColumnVO[] = [];
  private _candidates: ColumnMeta[] = [];
  private _columnMeta: ColumnMeta[] = [];
  private _dragIdx: number | null = null;

  // Shadow DOM refs
  private _root: ShadowRoot;
  private _titleEl: HTMLElement;
  private _countEl: HTMLElement;
  private _listEl: HTMLUListElement;
  private _emptyEl: HTMLElement;
  private _footerEl: HTMLElement;
  private _addSelect: HTMLSelectElement;
  private _itemTpl: HTMLTemplateElement;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._titleEl = this._root.getElementById("zone-title")!;
    this._countEl = this._root.getElementById("zone-count")!;
    this._listEl = this._root.getElementById("zone-list") as HTMLUListElement;
    this._emptyEl = this._root.getElementById("zone-empty")!;
    this._footerEl = this._root.getElementById("zone-footer")!;
    this._addSelect = this._root.getElementById(
      "add-select",
    ) as HTMLSelectElement;
    this._itemTpl = this._root.getElementById(
      "zone-item-tpl",
    ) as HTMLTemplateElement;

    // Set default title text
    this._titleEl.textContent = this._zoneLabel();
  }

  connectedCallback(): void {
    this._listEl.addEventListener("click", this._onClick);
    this._listEl.addEventListener("change", this._onAggChange);
    this._addSelect.addEventListener("change", this._onAddSelect);

    // Native DnD
    this._listEl.addEventListener("dragstart", this._onDragStart);
    this._listEl.addEventListener("dragover", this._onDragOver);
    this._listEl.addEventListener("dragleave", this._onDragLeave);
    this._listEl.addEventListener("drop", this._onDrop);
    this._listEl.addEventListener("dragend", this._onDragEnd);
  }

  disconnectedCallback(): void {
    this._listEl.removeEventListener("click", this._onClick);
    this._listEl.removeEventListener("change", this._onAggChange);
    this._addSelect.removeEventListener("change", this._onAddSelect);
    this._listEl.removeEventListener("dragstart", this._onDragStart);
    this._listEl.removeEventListener("dragover", this._onDragOver);
    this._listEl.removeEventListener("dragleave", this._onDragLeave);
    this._listEl.removeEventListener("drop", this._onDrop);
    this._listEl.removeEventListener("dragend", this._onDragEnd);
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private _render(): void {
    this._listEl.innerHTML = "";

    for (let i = 0; i < this._items.length; i++) {
      const vo = this._items[i];
      const li = this._itemTpl.content.firstElementChild!.cloneNode(
        true,
      ) as HTMLElement;
      li.dataset.colId = vo.id;
      li.dataset.index = String(i);

      li.querySelector(".item-label")!.textContent = vo.displayName;

      // AggFunc dropdown for values zone
      if (this._zone === "values") {
        const meta = this._columnMeta.find((c) => c.name === vo.id);
        const allowedAggs = meta?.pivot?.allowedAggs ?? [];
        if (allowedAggs.length > 0) {
          const sel = document.createElement("select");
          sel.className = "agg-select";
          sel.setAttribute("aria-label", `Aggregate for ${vo.displayName}`);
          for (const aggOpt of allowedAggs) {
            const opt = document.createElement("option");
            opt.value = aggOpt.agg;
            opt.textContent = aggOpt.label || AGG_LABELS[aggOpt.agg] || aggOpt.agg;
            sel.appendChild(opt);
          }
          sel.value = vo.aggFunc ?? AggFunc.Sum;
          // Insert before the remove button
          const removeBtn = li.querySelector(".btn-remove")!;
          li.insertBefore(sel, removeBtn);
        }
      }

      this._listEl.appendChild(li);
    }

    // Empty state
    this._emptyEl.hidden = this._items.length > 0;
    this._listEl.hidden = this._items.length === 0;

    // Count
    this._countEl.textContent = String(this._items.length);

    // Title
    this._titleEl.textContent = this._zoneLabel();
  }

  private _renderAddSelect(): void {
    this._addSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "+ Add column…";
    this._addSelect.appendChild(placeholder);

    for (const col of this._candidates) {
      const opt = document.createElement("option");
      opt.value = col.name;
      opt.textContent = col.label;
      this._addSelect.appendChild(opt);
    }

    // Hide footer when no candidates
    this._footerEl.hidden = this._candidates.length === 0;
  }

  private _zoneLabel(): string {
    switch (this._zone) {
      case "rows":
        return "Rows";
      case "columns":
        return "Columns";
      case "values":
        return "Values";
    }
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onClick = (e: Event): void => {
    const removeBtn = (e.target as HTMLElement).closest<HTMLElement>(
      ".btn-remove",
    );
    if (!removeBtn) return;
    const li = removeBtn.closest<HTMLElement>(".zone-item");
    if (!li?.dataset.colId) return;
    emit<ZoneRemoveDetail>(this, "zone-remove", {
      zone: this._zone,
      colId: li.dataset.colId,
    });
  };

  private _onAggChange = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("agg-select")) return;
    const li = target.closest<HTMLElement>(".zone-item");
    if (!li?.dataset.colId) return;
    emit<ZoneAggChangeDetail>(this, "zone-agg-change", {
      zone: this._zone,
      colId: li.dataset.colId,
      aggFunc: (target as HTMLSelectElement).value as AggFunc,
    });
  };

  private _onAddSelect = (): void => {
    const colId = this._addSelect.value;
    if (!colId) return;
    emit<ZoneAddDetail>(this, "zone-add", {
      zone: this._zone,
      colId,
    });
    // Reset to placeholder
    this._addSelect.value = "";
  };

  // -----------------------------------------------------------------------
  // Native HTML5 drag-and-drop (reorder within zone)
  // -----------------------------------------------------------------------

  private _getItemIndex(el: HTMLElement): number {
    return Array.from(this._listEl.children).indexOf(el);
  }

  private _onDragStart = (e: DragEvent): void => {
    const li = (e.target as HTMLElement).closest<HTMLElement>(".zone-item");
    if (!li) return;
    this._dragIdx = this._getItemIndex(li);
    li.classList.add("dragging");
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", String(this._dragIdx));
  };

  private _onDragOver = (e: DragEvent): void => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";

    const li = (e.target as HTMLElement).closest<HTMLElement>(".zone-item");
    if (!li) return;

    for (const child of this._listEl.children) {
      child.classList.remove("drag-over-top", "drag-over-bottom");
    }

    const rect = li.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      li.classList.add("drag-over-top");
    } else {
      li.classList.add("drag-over-bottom");
    }
  };

  private _onDragLeave = (e: DragEvent): void => {
    const li = (e.target as HTMLElement).closest<HTMLElement>(".zone-item");
    if (li) {
      li.classList.remove("drag-over-top", "drag-over-bottom");
    }
  };

  private _onDrop = (e: DragEvent): void => {
    e.preventDefault();
    const li = (e.target as HTMLElement).closest<HTMLElement>(".zone-item");
    if (!li || this._dragIdx === null) return;

    for (const child of this._listEl.children) {
      child.classList.remove("drag-over-top", "drag-over-bottom");
    }

    let toIdx = this._getItemIndex(li);
    const rect = li.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY >= midY) {
      toIdx += 1;
    }
    if (toIdx > this._dragIdx) {
      toIdx -= 1;
    }

    if (toIdx !== this._dragIdx) {
      emit<ZoneReorderDetail>(this, "zone-reorder", {
        zone: this._zone,
        fromIdx: this._dragIdx,
        toIdx,
      });
    }
    this._dragIdx = null;
  };

  private _onDragEnd = (): void => {
    this._dragIdx = null;
    for (const child of this._listEl.children) {
      child.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
    }
  };
}

customElements.define("sj-pivot-zone", SanjayaPivotZone);

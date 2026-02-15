// ---------------------------------------------------------------------------
// <sj-filter-basic> — flat AND condition list with "ALL" pseudo-operator
//
// Shows one row per available column. The "ALL" pseudo-operator means
// "no filter on this column" and is excluded from the emitted FilterGroup.
// An "Active only" toggle hides inactive (ALL) rows.
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "../../types/columns";
import { FilterOperator, FilterStyle } from "../../types/filters";
import type { FilterGroup } from "../../types/filters";
import { emit } from "../../shared/events";
import { template } from "./template";
import type { BasicRow } from "../helpers";
import {
  OPERATOR_LABELS,
  emptyBasicRow,
  basicRowsToFilterGroup,
  filterGroupToBasicRows,
  isBasicCompatible,
} from "../helpers";
import { renderValueWidget, readValueFromRow } from "../value-widgets";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-filter-basic>` — flat AND condition list.
 *
 * Each row corresponds to a column and has an operator + value widget.
 * The "ALL" pseudo-operator means "no filter on this column" and is
 * excluded from the emitted FilterGroup.
 *
 * @fires filter-dirty — Emitted whenever the working state changes.
 *        `event.detail` is the current `FilterGroup`.
 */
export class SanjayaFilterBasic extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  /** Available columns (set by parent). */
  get columns(): ColumnMeta[] {
    return this._columns;
  }

  set columns(value: ColumnMeta[]) {
    this._columns = value;
    this._initRows();
    this.render();
  }

  /** Get the current FilterGroup represented by the condition rows. */
  get filterGroup(): FilterGroup {
    return basicRowsToFilterGroup(this._rows);
  }

  /** Whether only active (non-ALL) rows are shown. */
  get activeOnly(): boolean {
    return this._activeOnly;
  }

  set activeOnly(value: boolean) {
    if (value === this._activeOnly) return;
    this._activeOnly = value;
    this._toggleActiveOnly.checked = value;
    this.render();
  }

  // ----- Internal state ---------------------------------------------------

  private _columns: ColumnMeta[] = [];
  private _rows: BasicRow[] = [];
  private _activeOnly = false;

  // Shadow DOM refs
  private _root: ShadowRoot;
  private _conditionsEl: HTMLElement;
  private _conditionRowTpl: HTMLTemplateElement;
  private _toggleActiveOnly: HTMLInputElement;
  private _activeCountEl: HTMLElement;
  private _emptyStateEl: HTMLElement;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._conditionsEl = this._root.getElementById("conditions")!;
    this._conditionRowTpl = this._root.getElementById(
      "condition-row-tpl",
    ) as HTMLTemplateElement;
    this._toggleActiveOnly = this._root.getElementById(
      "toggle-active-only",
    ) as HTMLInputElement;
    this._activeCountEl = this._root.getElementById("active-count")!;
    this._emptyStateEl = this._root.getElementById("empty-state")!;
  }

  connectedCallback(): void {
    this._toggleActiveOnly.addEventListener("change", this._onToggleActiveOnly);
    this._conditionsEl.addEventListener("change", this._onChange);
    this._conditionsEl.addEventListener("input", this._onInput);
  }

  disconnectedCallback(): void {
    this._toggleActiveOnly.removeEventListener("change", this._onToggleActiveOnly);
    this._conditionsEl.removeEventListener("change", this._onChange);
    this._conditionsEl.removeEventListener("input", this._onInput);
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Load a FilterGroup into basic mode. If the group is not
   * basic-compatible (e.g. OR, nested groups), reset to all-ALL rows.
   */
  loadFilterGroup(group: FilterGroup): void {
    if (isBasicCompatible(group) && this._columns.length > 0) {
      this._rows = filterGroupToBasicRows(group, this._columns);
    } else {
      this._initRows();
    }
    this.render();
  }

  /** Re-render from current internal state. */
  render(): void {
    const activeCount = this._rows.filter((r) => r.operator !== "ALL").length;
    this._activeCountEl.textContent =
      activeCount > 0 ? `${activeCount} active` : "";

    const visibleRows = this._activeOnly
      ? this._rows.filter((r) => r.operator !== "ALL")
      : this._rows;

    this._conditionsEl.innerHTML = "";
    for (const row of visibleRows) {
      // Find the original index in _rows (needed for change events)
      const index = this._rows.indexOf(row);
      const rowEl = this._createConditionRow(row, index);
      this._conditionsEl.appendChild(rowEl);
    }

    // Empty state when filtering shows nothing
    this._emptyStateEl.hidden = !(this._activeOnly && visibleRows.length === 0);
  }

  // -----------------------------------------------------------------------
  // Private — initialisation
  // -----------------------------------------------------------------------

  private _initRows(): void {
    this._rows = this._columns.map((col) => emptyBasicRow(col.name));
  }

  // -----------------------------------------------------------------------
  // Private — rendering
  // -----------------------------------------------------------------------

  private _createConditionRow(row: BasicRow, index: number): HTMLElement {
    const el =
      this._conditionRowTpl.content.firstElementChild!.cloneNode(
        true,
      ) as HTMLElement;
    el.dataset.index = String(index);

    const colLabel = el.querySelector(".col-label") as HTMLElement;
    const opSelect = el.querySelector(".op-select") as HTMLSelectElement;
    const valueContainer = el.querySelector(".value-input") as HTMLElement;

    // Set column label
    const colMeta = this._columns.find((c) => c.name === row.column);
    colLabel.textContent = colMeta?.label ?? row.column;

    // Populate operator dropdown
    this._populateOperators(opSelect, colMeta, row.operator);

    // Value widget
    renderValueWidget(valueContainer, colMeta, row);

    return el;
  }

  private _populateOperators(
    select: HTMLSelectElement,
    colMeta: ColumnMeta | undefined,
    selectedOp: string,
  ): void {
    select.innerHTML = "";

    // "ALL" pseudo-operator (always first)
    const allOpt = document.createElement("option");
    allOpt.value = "ALL";
    allOpt.textContent = "ALL";
    select.appendChild(allOpt);

    if (colMeta) {
      if (colMeta.filterStyle === FilterStyle.Select) {
        // If filterStyle is "select", just show "is one of"
        const opt = document.createElement("option");
        opt.value = FilterOperator.In;
        opt.textContent =
          OPERATOR_LABELS[FilterOperator.In] ?? FilterOperator.In;
        select.appendChild(opt);
      } else {
        for (const op of colMeta.operators) {
          const opt = document.createElement("option");
          opt.value = op;
          opt.textContent = OPERATOR_LABELS[op] ?? op;
          select.appendChild(opt);
        }
      }
    }

    // Explicitly set the value after all options are added
    select.value = selectedOp;
  }

  // -----------------------------------------------------------------------
  // Private — read rows from DOM
  // -----------------------------------------------------------------------

  private _readRows(): void {
    const rowEls =
      this._conditionsEl.querySelectorAll<HTMLElement>(".condition-row");

    for (const rowEl of rowEls) {
      const idx = parseInt(rowEl.dataset.index!, 10);
      const opSelect = rowEl.querySelector(".op-select") as HTMLSelectElement;
      const operator = opSelect.value;

      const { value, valueTo } = readValueFromRow(rowEl, operator);
      this._rows[idx] = {
        ...this._rows[idx],
        operator,
        value,
        valueTo,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Private — notify parent
  // -----------------------------------------------------------------------

  private _emitDirty(): void {
    emit<FilterGroup>(this, "filter-dirty", this.filterGroup);
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onToggleActiveOnly = (): void => {
    this._activeOnly = this._toggleActiveOnly.checked;
    this.render();
  };

  private _onChange = (e: Event): void => {
    const target = e.target as HTMLElement;
    const rowEl = target.closest<HTMLElement>(".condition-row");
    if (!rowEl?.dataset.index) return;
    const idx = parseInt(rowEl.dataset.index, 10);
    const row = this._rows[idx];
    if (!row) return;

    if (target.classList.contains("op-select")) {
      row.operator = (target as HTMLSelectElement).value;
      row.value = undefined;
      row.valueTo = undefined;
      this.render();
      this._emitDirty();
    } else if (
      target.classList.contains("multi-check") ||
      target.classList.contains("value-bool")
    ) {
      this._readRows();
      this._emitDirty();
    }
  };

  private _onInput = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (
      target.classList.contains("value-field") ||
      target.classList.contains("value-from") ||
      target.classList.contains("value-to")
    ) {
      this._readRows();
      this._emitDirty();
    }
  };
}

customElements.define("sj-filter-basic", SanjayaFilterBasic);

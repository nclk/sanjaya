// ---------------------------------------------------------------------------
// <sj-filter-basic> — flat AND condition list with "ALL" pseudo-operator
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "../../types/columns.js";
import { FilterOperator, FilterStyle } from "../../types/filters.js";
import type { FilterGroup } from "../../types/filters.js";
import { emit } from "../../shared/events.js";
import { template } from "./template.js";
import type { BasicRow } from "../helpers.js";
import {
  OPERATOR_LABELS,
  emptyBasicRow,
  basicRowsToFilterGroup,
  filterGroupToBasicRows,
  isBasicCompatible,
} from "../helpers.js";
import { renderValueWidget, readValueFromRow } from "../value-widgets.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-filter-basic>` — flat AND condition list.
 *
 * Each row is a column + operator + value widget. The "ALL" pseudo-operator
 * means "no filter on this column" and is excluded from the emitted
 * FilterGroup.
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

  // ----- Internal state ---------------------------------------------------

  private _columns: ColumnMeta[] = [];
  private _rows: BasicRow[] = [];

  // Shadow DOM refs
  private _root: ShadowRoot;
  private _conditionsEl: HTMLElement;
  private _btnAdd: HTMLButtonElement;
  private _conditionRowTpl: HTMLTemplateElement;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._conditionsEl = this._root.getElementById("conditions")!;
    this._btnAdd = this._root.getElementById(
      "btn-add-condition",
    ) as HTMLButtonElement;
    this._conditionRowTpl = this._root.getElementById(
      "condition-row-tpl",
    ) as HTMLTemplateElement;
  }

  connectedCallback(): void {
    this._btnAdd.addEventListener("click", this._onAddCondition);
    this._conditionsEl.addEventListener("change", this._onChange);
    this._conditionsEl.addEventListener("input", this._onInput);
    this._conditionsEl.addEventListener("click", this._onClick);
  }

  disconnectedCallback(): void {
    this._btnAdd.removeEventListener("click", this._onAddCondition);
    this._conditionsEl.removeEventListener("change", this._onChange);
    this._conditionsEl.removeEventListener("input", this._onInput);
    this._conditionsEl.removeEventListener("click", this._onClick);
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Load a FilterGroup into basic mode. If the group is not
   * basic-compatible (e.g. OR, nested groups), reset to a single ALL row.
   */
  loadFilterGroup(group: FilterGroup): void {
    if (isBasicCompatible(group) && this._columns.length > 0) {
      this._rows = filterGroupToBasicRows(group, this._columns);
      // Drop rows for columns that no longer exist
      this._rows = this._rows.filter((r) =>
        this._columns.some((c) => c.name === r.column),
      );
      if (this._rows.length === 0) {
        this._rows = [emptyBasicRow(this._columns[0].name)];
      }
    } else {
      this._initRows();
    }
    this.render();
  }

  /** Re-render from current internal state. */
  render(): void {
    this._conditionsEl.innerHTML = "";
    for (let i = 0; i < this._rows.length; i++) {
      const rowEl = this._createConditionRow(this._rows[i], i);
      this._conditionsEl.appendChild(rowEl);
    }
  }

  // -----------------------------------------------------------------------
  // Private — initialisation
  // -----------------------------------------------------------------------

  private _initRows(): void {
    this._rows =
      this._columns.length > 0
        ? [emptyBasicRow(this._columns[0].name)]
        : [];
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

    const colSelect = el.querySelector(".col-select") as HTMLSelectElement;
    const opSelect = el.querySelector(".op-select") as HTMLSelectElement;
    const valueContainer = el.querySelector(".value-input") as HTMLElement;

    // Populate column dropdown
    for (const col of this._columns) {
      const opt = document.createElement("option");
      opt.value = col.name;
      opt.textContent = col.label;
      colSelect.appendChild(opt);
    }
    colSelect.value = row.column;

    // Populate operator dropdown
    const colMeta = this._columns.find((c) => c.name === row.column);
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
    this._rows = [];

    for (const rowEl of rowEls) {
      const colSelect = rowEl.querySelector(".col-select") as HTMLSelectElement;
      const opSelect = rowEl.querySelector(".op-select") as HTMLSelectElement;
      const column = colSelect.value;
      const operator = opSelect.value;

      const { value, valueTo } = readValueFromRow(rowEl, operator);
      this._rows.push({ column, operator, value, valueTo });
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

  private _onAddCondition = (): void => {
    if (this._columns.length === 0) return;
    this._rows.push(emptyBasicRow(this._columns[0].name));
    this.render();
    this._emitDirty();
  };

  private _onChange = (e: Event): void => {
    const target = e.target as HTMLElement;
    const rowEl = target.closest<HTMLElement>(".condition-row");
    if (!rowEl?.dataset.index) return;
    const idx = parseInt(rowEl.dataset.index, 10);
    const row = this._rows[idx];
    if (!row) return;

    if (target.classList.contains("col-select")) {
      row.column = (target as HTMLSelectElement).value;
      row.operator = "ALL";
      row.value = undefined;
      row.valueTo = undefined;
      this.render();
      this._emitDirty();
    } else if (target.classList.contains("op-select")) {
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

  private _onClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest<HTMLElement>(".remove-condition");
    if (!removeBtn) return;

    const rowEl = removeBtn.closest<HTMLElement>(".condition-row");
    if (!rowEl?.dataset.index) return;
    const idx = parseInt(rowEl.dataset.index, 10);
    this._rows.splice(idx, 1);
    this.render();
    this._emitDirty();
  };
}

customElements.define("sj-filter-basic", SanjayaFilterBasic);

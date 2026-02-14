// ---------------------------------------------------------------------------
// <sj-filter-advanced> — recursive FilterGroup tree editor
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "../../types/columns.js";
import {
  FilterOperator,
  FilterCombinator,
  emptyFilterGroup,
} from "../../types/filters.js";
import type { FilterCondition, FilterGroup } from "../../types/filters.js";
import { emit } from "../../shared/events.js";
import { template } from "./template.js";
import type { BasicRow } from "../helpers.js";
import { OPERATOR_LABELS, NULL_OPERATORS } from "../helpers.js";
import { renderValueWidget, readConditionValue } from "../value-widgets.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-filter-advanced>` — recursive filter group tree.
 *
 * Supports AND/OR combinator, per-group NOT, per-condition NOT,
 * nested sub-groups, and arbitrary depth.
 *
 * @fires filter-dirty — Emitted whenever the working state changes.
 *        `event.detail` is the current `FilterGroup`.
 */
export class SanjayaFilterAdvanced extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  /** Available columns (set by parent). */
  get columns(): ColumnMeta[] {
    return this._columns;
  }

  set columns(value: ColumnMeta[]) {
    this._columns = value;
  }

  /** The current FilterGroup being edited. */
  get filterGroup(): FilterGroup {
    return this._filterGroup;
  }

  // ----- Internal state ---------------------------------------------------

  private _columns: ColumnMeta[] = [];
  private _filterGroup: FilterGroup = emptyFilterGroup();

  // Shadow DOM refs
  private _root: ShadowRoot;
  private _rootEl: HTMLElement;
  private _conditionRowTpl: HTMLTemplateElement;
  private _filterGroupTpl: HTMLTemplateElement;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._rootEl = this._root.getElementById("root")!;
    this._conditionRowTpl = this._root.getElementById(
      "condition-row-tpl",
    ) as HTMLTemplateElement;
    this._filterGroupTpl = this._root.getElementById(
      "filter-group-tpl",
    ) as HTMLTemplateElement;
  }

  connectedCallback(): void {
    this._rootEl.addEventListener("change", this._onChange);
    this._rootEl.addEventListener("input", this._onInput);
    this._rootEl.addEventListener("click", this._onClick);
  }

  disconnectedCallback(): void {
    this._rootEl.removeEventListener("change", this._onChange);
    this._rootEl.removeEventListener("input", this._onInput);
    this._rootEl.removeEventListener("click", this._onClick);
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /** Load a FilterGroup and render the tree. */
  loadFilterGroup(group: FilterGroup): void {
    this._filterGroup = structuredClone(group);
    this.render();
  }

  /** Re-render the full tree from internal state. */
  render(): void {
    this._rootEl.innerHTML = "";
    const el = this._createGroupElement(
      this._filterGroup,
      /* isRoot */ true,
      [],
    );
    this._rootEl.appendChild(el);
  }

  // -----------------------------------------------------------------------
  // Private — rendering
  // -----------------------------------------------------------------------

  private _createGroupElement(
    group: FilterGroup,
    isRoot: boolean,
    path: number[],
  ): HTMLElement {
    const el =
      this._filterGroupTpl.content.firstElementChild!.cloneNode(
        true,
      ) as HTMLElement;
    el.dataset.path = JSON.stringify(path);

    // Combinator toggle
    const andBtn = el.querySelector(
      ".combinator-and",
    ) as HTMLButtonElement;
    const orBtn = el.querySelector(
      ".combinator-or",
    ) as HTMLButtonElement;
    andBtn.setAttribute(
      "aria-pressed",
      String(group.combinator === FilterCombinator.And),
    );
    orBtn.setAttribute(
      "aria-pressed",
      String(group.combinator === FilterCombinator.Or),
    );

    // NOT toggle
    const notCheck = el.querySelector(
      ".group-not-check",
    ) as HTMLInputElement;
    notCheck.checked = group.not === true;

    // Remove button hidden for root group
    const removeBtn = el.querySelector(
      ".remove-group-btn",
    ) as HTMLButtonElement;
    if (isRoot) {
      removeBtn.hidden = true;
    }

    // Render conditions
    const conditionsContainer = el.querySelector(
      ".group-conditions",
    ) as HTMLElement;
    for (let i = 0; i < (group.conditions?.length ?? 0); i++) {
      const cond = group.conditions![i];
      const condEl = this._createConditionRow(cond, i, path);
      conditionsContainer.appendChild(condEl);
    }

    // Render sub-groups recursively
    const subgroupsContainer = el.querySelector(
      ".group-subgroups",
    ) as HTMLElement;
    for (let i = 0; i < (group.groups?.length ?? 0); i++) {
      const subGroup = group.groups![i];
      const subEl = this._createGroupElement(subGroup, false, [
        ...path,
        i,
      ]);
      subgroupsContainer.appendChild(subEl);
    }

    return el;
  }

  private _createConditionRow(
    cond: FilterCondition,
    index: number,
    groupPath: number[],
  ): HTMLElement {
    const el =
      this._conditionRowTpl.content.firstElementChild!.cloneNode(
        true,
      ) as HTMLElement;
    el.dataset.condIndex = String(index);
    el.dataset.groupPath = JSON.stringify(groupPath);

    // Insert NOT checkbox before the column select
    const notLabel = document.createElement("label");
    notLabel.className = "condition-not";
    const notCb = document.createElement("input");
    notCb.type = "checkbox";
    notCb.className = "condition-not-check";
    notCb.checked = cond.not === true;
    notLabel.append(notCb, " NOT");
    el.insertBefore(notLabel, el.firstChild);

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
    colSelect.value = cond.column;

    // Build a BasicRow-like object for value rendering
    const colMeta = this._columns.find((c) => c.name === cond.column);
    const rowLike: BasicRow = {
      column: cond.column,
      operator: cond.operator,
      value: undefined,
    };

    if (
      cond.operator === FilterOperator.Between &&
      Array.isArray(cond.value)
    ) {
      rowLike.value = cond.value[0];
      rowLike.valueTo = cond.value[1];
    } else if (!NULL_OPERATORS.has(cond.operator)) {
      rowLike.value =
        cond.operator === FilterOperator.In && Array.isArray(cond.value)
          ? cond.value.join(", ")
          : cond.value;
    }

    // Populate operator dropdown (no "ALL" in advanced mode)
    opSelect.innerHTML = "";
    if (colMeta) {
      for (const op of colMeta.operators) {
        const opt = document.createElement("option");
        opt.value = op;
        opt.textContent = OPERATOR_LABELS[op] ?? op;
        opSelect.appendChild(opt);
      }
    }
    opSelect.value = cond.operator;

    // Value widget
    renderValueWidget(valueContainer, colMeta, rowLike);

    return el;
  }

  // -----------------------------------------------------------------------
  // Private — read state from DOM
  // -----------------------------------------------------------------------

  private _readState(): void {
    const rootGroupEl =
      this._rootEl.querySelector<HTMLElement>(".filter-group");
    if (!rootGroupEl) return;
    this._filterGroup = this._readGroupFromDOM(rootGroupEl);
  }

  private _readGroupFromDOM(groupEl: HTMLElement): FilterGroup {
    const andBtn = groupEl.querySelector(
      ":scope > .group-header .combinator-and",
    ) as HTMLButtonElement;
    const notCheck = groupEl.querySelector(
      ":scope > .group-header .group-not-check",
    ) as HTMLInputElement;

    const combinator =
      andBtn?.getAttribute("aria-pressed") === "true"
        ? FilterCombinator.And
        : FilterCombinator.Or;

    const group: FilterGroup = {
      combinator,
      conditions: [],
      groups: [],
    };

    if (notCheck?.checked) {
      group.not = true;
    }

    // Read conditions
    const condContainer = groupEl.querySelector(
      ":scope > .group-conditions",
    ) as HTMLElement;
    if (condContainer) {
      const condRows =
        condContainer.querySelectorAll<HTMLElement>(
          ":scope > .condition-row",
        );
      for (const condEl of condRows) {
        const cond = this._readConditionFromDOM(condEl);
        if (cond) group.conditions!.push(cond);
      }
    }

    // Read sub-groups
    const subgroupContainer = groupEl.querySelector(
      ":scope > .group-subgroups",
    ) as HTMLElement;
    if (subgroupContainer) {
      const subGroups =
        subgroupContainer.querySelectorAll<HTMLElement>(
          ":scope > .filter-group",
        );
      for (const subEl of subGroups) {
        group.groups!.push(this._readGroupFromDOM(subEl));
      }
    }

    return group;
  }

  private _readConditionFromDOM(
    rowEl: HTMLElement,
  ): FilterCondition | null {
    const colSelect = rowEl.querySelector(
      ".col-select",
    ) as HTMLSelectElement | null;
    const opSelect = rowEl.querySelector(
      ".op-select",
    ) as HTMLSelectElement | null;
    if (!colSelect || !opSelect) return null;

    const column = colSelect.value;
    const operator = opSelect.value as FilterOperator;
    const notCheck = rowEl.querySelector(
      ".condition-not-check",
    ) as HTMLInputElement | null;

    const cond: FilterCondition = { column, operator };
    if (notCheck?.checked) {
      cond.not = true;
    }

    const value = readConditionValue(rowEl, operator);
    if (value !== undefined) {
      cond.value = value;
    }

    return cond;
  }

  // -----------------------------------------------------------------------
  // Private — mutations (operate on _filterGroup, then re-render)
  // -----------------------------------------------------------------------

  private _getGroupAtPath(path: number[]): FilterGroup {
    let group = this._filterGroup;
    for (const idx of path) {
      group = group.groups![idx];
    }
    return group;
  }

  private _addConditionToGroup(path: number[]): void {
    const group = this._getGroupAtPath(path);
    if (!group.conditions) group.conditions = [];
    const defaultCol =
      this._columns.length > 0 ? this._columns[0].name : "";
    const defaultOp =
      this._columns.length > 0 && this._columns[0].operators.length > 0
        ? this._columns[0].operators[0]
        : FilterOperator.Eq;
    group.conditions.push({ column: defaultCol, operator: defaultOp });
    this.render();
    this._emitDirty();
  }

  private _addSubGroup(path: number[]): void {
    const group = this._getGroupAtPath(path);
    if (!group.groups) group.groups = [];
    group.groups.push({
      combinator: FilterCombinator.And,
      conditions: [],
      groups: [],
    });
    this.render();
    this._emitDirty();
  }

  private _removeConditionFromGroup(
    path: number[],
    condIndex: number,
  ): void {
    const group = this._getGroupAtPath(path);
    group.conditions?.splice(condIndex, 1);
    this.render();
    this._emitDirty();
  }

  private _removeGroup(path: number[]): void {
    if (path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const parent = this._getGroupAtPath(parentPath);
    parent.groups?.splice(path[path.length - 1], 1);
    this.render();
    this._emitDirty();
  }

  // -----------------------------------------------------------------------
  // Private — notify parent
  // -----------------------------------------------------------------------

  private _emitDirty(): void {
    emit<FilterGroup>(this, "filter-dirty", this._filterGroup);
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onChange = (e: Event): void => {
    const target = e.target as HTMLElement;

    // Column or operator select changed — re-render value widget
    if (
      target.classList.contains("col-select") ||
      target.classList.contains("op-select")
    ) {
      this._readState();
      this.render();
      this._emitDirty();
      return;
    }

    // Group NOT toggle, condition NOT toggle, multi-check, or bool
    if (
      target.classList.contains("group-not-check") ||
      target.classList.contains("condition-not-check") ||
      target.classList.contains("multi-check") ||
      target.classList.contains("value-bool")
    ) {
      this._readState();
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
      this._readState();
      this._emitDirty();
    }
  };

  private _onClick = (e: Event): void => {
    const target = e.target as HTMLElement;

    // Combinator toggle
    const combBtn = target.closest<HTMLButtonElement>(".combinator-btn");
    if (combBtn) {
      const groupEl = combBtn.closest<HTMLElement>(".filter-group");
      if (!groupEl) return;
      const andBtn = groupEl.querySelector(
        ":scope > .group-header .combinator-and",
      ) as HTMLButtonElement;
      const orBtn = groupEl.querySelector(
        ":scope > .group-header .combinator-or",
      ) as HTMLButtonElement;
      const isAnd = combBtn.classList.contains("combinator-and");
      andBtn.setAttribute("aria-pressed", String(isAnd));
      orBtn.setAttribute("aria-pressed", String(!isAnd));
      this._readState();
      this._emitDirty();
      return;
    }

    // Add condition
    if (target.closest(".add-condition-btn")) {
      this._readState();
      const groupEl = target.closest<HTMLElement>(".filter-group");
      if (!groupEl) return;
      const path = JSON.parse(
        groupEl.dataset.path ?? "[]",
      ) as number[];
      this._addConditionToGroup(path);
      return;
    }

    // Add sub-group
    if (target.closest(".add-group-btn")) {
      this._readState();
      const groupEl = target.closest<HTMLElement>(".filter-group");
      if (!groupEl) return;
      const path = JSON.parse(
        groupEl.dataset.path ?? "[]",
      ) as number[];
      this._addSubGroup(path);
      return;
    }

    // Remove condition
    const removeCondBtn =
      target.closest<HTMLElement>(".remove-condition");
    if (removeCondBtn) {
      this._readState();
      const rowEl =
        removeCondBtn.closest<HTMLElement>(".condition-row");
      const groupEl =
        removeCondBtn.closest<HTMLElement>(".filter-group");
      if (!rowEl || !groupEl) return;
      const condIndex = parseInt(
        rowEl.dataset.condIndex ?? "0",
        10,
      );
      const path = JSON.parse(
        groupEl.dataset.path ?? "[]",
      ) as number[];
      this._removeConditionFromGroup(path, condIndex);
      return;
    }

    // Remove group
    if (target.closest(".remove-group-btn")) {
      this._readState();
      const groupEl = target.closest<HTMLElement>(".filter-group");
      if (!groupEl) return;
      const path = JSON.parse(
        groupEl.dataset.path ?? "[]",
      ) as number[];
      if (path.length === 0) return; // Cannot remove root
      this._removeGroup(path);
    }
  };
}

customElements.define("sj-filter-advanced", SanjayaFilterAdvanced);

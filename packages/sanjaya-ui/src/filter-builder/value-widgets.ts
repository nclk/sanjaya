// ---------------------------------------------------------------------------
// Value widget rendering and reading
//
// Pure-ish functions that build and read value input widgets for filter
// condition rows. Used by both basic and advanced mode components.
// ---------------------------------------------------------------------------

import type { ColumnMeta } from "../types/columns.js";
import { ColumnType } from "../types/columns.js";
import { FilterOperator, FilterStyle } from "../types/filters.js";
import type { BasicRow } from "./helpers.js";
import { NULL_OPERATORS, inputTypeForColumn } from "./helpers.js";

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render the appropriate value widget inside `container` based on the
 * column type and selected operator.
 *
 * **Side effects:** mutates `container` (clears children, or replaces the
 * element entirely for between/multi-select/boolean layouts).
 */
export function renderValueWidget(
  container: HTMLElement,
  colMeta: ColumnMeta | undefined,
  row: BasicRow,
): void {
  container.innerHTML = "";

  // No value for "ALL" or null operators
  if (row.operator === "ALL" || NULL_OPERATORS.has(row.operator)) {
    return;
  }

  // Between — two inputs
  if (row.operator === FilterOperator.Between) {
    const wrap = document.createElement("div");
    wrap.className = "value-between";
    const type = colMeta ? inputTypeForColumn(colMeta) : "text";

    const inp1 = document.createElement("input");
    inp1.type = type;
    inp1.className = "value-from";
    inp1.placeholder = "from";
    if (row.value != null) inp1.value = String(row.value);

    const sep = document.createElement("span");
    sep.className = "between-sep";
    sep.textContent = "and";

    const inp2 = document.createElement("input");
    inp2.type = type;
    inp2.className = "value-to";
    inp2.placeholder = "to";
    if (row.valueTo != null) inp2.value = String(row.valueTo);

    wrap.append(inp1, sep, inp2);
    container.replaceWith(wrap);
    return;
  }

  // Multi-select (filterStyle: "select" with enumValues)
  if (
    colMeta?.filterStyle === FilterStyle.Select &&
    colMeta.enumValues?.length
  ) {
    const wrap = document.createElement("div");
    wrap.className = "multi-select";
    const selected = new Set<string>(
      Array.isArray(row.value)
        ? row.value.map(String)
        : typeof row.value === "string"
          ? row.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
    );
    for (const val of colMeta.enumValues) {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = val;
      cb.className = "multi-check";
      cb.checked = selected.has(val);
      label.append(cb, ` ${val}`);
      wrap.appendChild(label);
    }
    container.replaceWith(wrap);
    return;
  }

  // Boolean column — checkbox toggle
  if (colMeta?.type === ColumnType.Boolean) {
    const wrap = document.createElement("div");
    wrap.className = "bool-toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "value-bool";
    cb.checked = row.value === true || row.value === "true";
    const label = document.createElement("span");
    label.textContent = "true";
    wrap.append(cb, label);
    container.replaceWith(wrap);
    return;
  }

  // In operator — comma-separated text input
  if (row.operator === FilterOperator.In) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "value-field";
    inp.placeholder = "value1, value2, …";
    if (row.value != null) inp.value = String(row.value);
    container.appendChild(inp);
    return;
  }

  // Default — single input matching column type
  const inp = document.createElement("input");
  inp.type = colMeta ? inputTypeForColumn(colMeta) : "text";
  inp.className = "value-field";
  inp.placeholder = "value";
  if (row.value != null) inp.value = String(row.value);
  container.appendChild(inp);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read a BasicRow's value fields from a condition-row DOM element.
 * Returns `{ value, valueTo }`.
 */
export function readValueFromRow(
  rowEl: HTMLElement,
  operator: string,
): { value: unknown; valueTo?: unknown } {
  if (operator === "ALL" || NULL_OPERATORS.has(operator)) {
    return { value: undefined };
  }

  if (operator === FilterOperator.Between) {
    const from = rowEl.querySelector(".value-from") as HTMLInputElement | null;
    const to = rowEl.querySelector(".value-to") as HTMLInputElement | null;
    return { value: from?.value ?? undefined, valueTo: to?.value ?? undefined };
  }

  // Multi-select checkboxes
  const multiChecks = rowEl.querySelectorAll<HTMLInputElement>(".multi-check");
  if (multiChecks.length > 0) {
    return {
      value: Array.from(multiChecks)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value),
    };
  }

  // Boolean toggle
  const boolCb = rowEl.querySelector(".value-bool") as HTMLInputElement | null;
  if (boolCb) {
    return { value: boolCb.checked };
  }

  // Regular input (text / number / date)
  const inp = rowEl.querySelector(".value-field") as HTMLInputElement | null;
  return { value: inp?.value ?? undefined };
}

/**
 * Read a FilterCondition's value from a condition-row DOM element.
 * Handles In-operator parsing (comma-separated → array).
 */
export function readConditionValue(
  rowEl: HTMLElement,
  operator: string,
): unknown {
  if (NULL_OPERATORS.has(operator)) {
    return undefined;
  }

  if (operator === FilterOperator.Between) {
    const from = rowEl.querySelector(".value-from") as HTMLInputElement | null;
    const to = rowEl.querySelector(".value-to") as HTMLInputElement | null;
    return [from?.value ?? "", to?.value ?? ""];
  }

  const multiChecks = rowEl.querySelectorAll<HTMLInputElement>(".multi-check");
  if (multiChecks.length > 0) {
    return Array.from(multiChecks)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  }

  const boolCb = rowEl.querySelector(".value-bool") as HTMLInputElement | null;
  if (boolCb) {
    return boolCb.checked;
  }

  const inp = rowEl.querySelector(".value-field") as HTMLInputElement | null;
  if (inp) {
    return operator === FilterOperator.In
      ? inp.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : inp.value;
  }

  return undefined;
}

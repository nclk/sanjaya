// ---------------------------------------------------------------------------
// Typed event helpers — dispatch CustomEvents + optional callback props
// ---------------------------------------------------------------------------

/**
 * Capitalize the first character of a string.
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Convert a kebab-case event name to camelCase.
 *
 * `"dataset-change"` → `"datasetChange"`
 */
function camelize(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Build the callback property name from a kebab-case event name.
 *
 * `"dataset-change"` → `"onDatasetChange"`
 */
export function callbackName(eventName: string): string {
  return `on${capitalize(camelize(eventName))}`;
}

/**
 * Dispatch a bubbling, composed `CustomEvent<T>` on `element` and
 * optionally invoke a callback property if one is set.
 *
 * The callback property name is derived from the event name:
 *   `"filter-change"` → `element.onFilterChange`
 *
 * Using `composed: true` ensures the event crosses Shadow DOM boundaries
 * so ancestor elements (including the orchestrator) can listen for it.
 *
 * @example
 * ```ts
 * // Inside a component method:
 * emit(this, 'filter-change', filterGroup);
 *
 * // Host can listen either way:
 * el.addEventListener('filter-change', (e) => { … });
 * el.onFilterChange = (detail) => { … };
 * ```
 */
export function emit<T>(element: HTMLElement, name: string, detail: T): void {
  // Always dispatch the DOM event
  element.dispatchEvent(
    new CustomEvent<T>(name, {
      detail,
      bubbles: true,
      composed: true,
    }),
  );

  // Also invoke the callback prop if it exists
  const cbProp = callbackName(name);
  const cb = (element as unknown as Record<string, unknown>)[cbProp];
  if (typeof cb === "function") {
    (cb as (detail: T) => void)(detail);
  }
}

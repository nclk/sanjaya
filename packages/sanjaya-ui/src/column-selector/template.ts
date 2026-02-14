// AUTO-GENERATED - DO NOT EDIT
// Generated from template.html by @pojagi/build-templates

/**
 * Template HTML for <column-selector>
 * Edit the source template.html file, not this file.
 */
export const template = `<style>
  :host {
    display: block;
    font-family: var(--sanjaya-font-family, sans-serif);
    font-size: var(--sanjaya-font-size-md, 0.875rem);
    color: var(--sanjaya-color-on-surface, #212121);
  }

  .panel {
    background: var(--sanjaya-color-surface, #ffffff);
    border: 1px solid var(--sanjaya-color-border, #e0e0e0);
    border-radius: var(--sanjaya-radius-md, 6px);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sanjaya-spacing-sm, 8px) var(--sanjaya-spacing-lg, 16px);
    background: var(--sanjaya-color-surface-variant, #f5f5f5);
    border-bottom: 1px solid var(--sanjaya-color-border, #e0e0e0);
    gap: var(--sanjaya-spacing-sm, 8px);
  }

  .panel-title {
    font-weight: var(--sanjaya-font-weight-medium, 500);
    font-size: var(--sanjaya-font-size-sm, 0.8125rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sanjaya-color-on-surface-secondary, #616161);
    flex-shrink: 0;
  }

  .panel-actions {
    display: flex;
    gap: var(--sanjaya-spacing-xs, 4px);
    align-items: center;
  }

  .panel-body {
    padding: var(--sanjaya-spacing-md, 12px) var(--sanjaya-spacing-lg, 16px);
  }

  /* ---- Toolbar --------------------------------------------------------- */

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--sanjaya-spacing-sm, 8px);
    margin-bottom: var(--sanjaya-spacing-sm, 8px);
  }

  .toolbar-spacer {
    flex: 1;
  }

  .select-all-label {
    display: flex;
    align-items: center;
    gap: var(--sanjaya-spacing-xs, 4px);
    font-size: var(--sanjaya-font-size-sm, 0.8125rem);
    color: var(--sanjaya-color-on-surface-secondary, #616161);
    cursor: pointer;
    user-select: none;
  }

  .select-all-label input[type="checkbox"] {
    accent-color: var(--sanjaya-color-primary, #1976d2);
    cursor: pointer;
  }

  .column-count {
    font-size: var(--sanjaya-font-size-xs, 0.6875rem);
    color: var(--sanjaya-color-on-surface-secondary, #616161);
  }

  /* ---- Column list ----------------------------------------------------- */

  .column-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 320px;
    overflow-y: auto;
  }

  .column-item {
    display: flex;
    align-items: center;
    gap: var(--sanjaya-spacing-sm, 8px);
    padding: var(--sanjaya-spacing-xs, 4px) var(--sanjaya-spacing-sm, 8px);
    border-radius: var(--sanjaya-radius-sm, 4px);
    transition: background var(--sanjaya-transition-fast, 120ms ease-in-out);
    border: 2px solid transparent;
    cursor: grab;
  }

  .column-item:hover {
    background: var(--sanjaya-color-surface-variant, #f5f5f5);
  }

  .column-item:focus-visible {
    outline: none;
    border-color: var(--sanjaya-color-primary, #1976d2);
    box-shadow: 0 0 0 2px var(--sanjaya-color-focus-ring, rgba(25, 118, 210, 0.3));
  }

  .column-item.dragging {
    opacity: 0.4;
  }

  .column-item.drag-over-top {
    border-top-color: var(--sanjaya-color-primary, #1976d2);
  }

  .column-item.drag-over-bottom {
    border-bottom-color: var(--sanjaya-color-primary, #1976d2);
  }

  /* ---- Drag handle ------------------------------------------------------ */

  .drag-handle {
    display: flex;
    align-items: center;
    cursor: grab;
    color: var(--sanjaya-color-disabled, #bdbdbd);
    flex-shrink: 0;
    touch-action: none;
  }

  .drag-handle svg {
    width: 16px;
    height: 16px;
  }

  /* ---- Checkbox -------------------------------------------------------- */

  .column-item input[type="checkbox"] {
    accent-color: var(--sanjaya-color-primary, #1976d2);
    cursor: pointer;
    flex-shrink: 0;
  }

  /* ---- Column label ---------------------------------------------------- */

  .column-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- isGroup toggle -------------------------------------------------- */

  .group-toggle {
    display: flex;
    align-items: center;
    gap: var(--sanjaya-spacing-xxs, 2px);
    flex-shrink: 0;
  }

  .group-toggle-label {
    font-size: var(--sanjaya-font-size-xs, 0.6875rem);
    color: var(--sanjaya-color-on-surface-secondary, #616161);
    user-select: none;
  }

  .group-toggle input[type="checkbox"] {
    position: relative;
    width: 28px;
    height: 16px;
    appearance: none;
    -webkit-appearance: none;
    background: var(--sanjaya-color-disabled, #bdbdbd);
    border-radius: 8px;
    cursor: pointer;
    transition: background var(--sanjaya-transition-fast, 120ms ease-in-out);
    flex-shrink: 0;
  }

  .group-toggle input[type="checkbox"]::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--sanjaya-transition-fast, 120ms ease-in-out);
  }

  .group-toggle input[type="checkbox"]:checked {
    background: var(--sanjaya-color-primary, #1976d2);
  }

  .group-toggle input[type="checkbox"]:checked::after {
    transform: translateX(12px);
  }

  .group-toggle input[type="checkbox"]:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ---- Empty state ------------------------------------------------------ */

  .empty-state {
    text-align: center;
    padding: var(--sanjaya-spacing-xl, 24px);
    color: var(--sanjaya-color-on-surface-secondary, #616161);
    font-size: var(--sanjaya-font-size-sm, 0.8125rem);
  }

  /* ---- Buttons --------------------------------------------------------- */

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanjaya-spacing-xs, 4px) var(--sanjaya-spacing-sm, 8px);
    border: 1px solid var(--sanjaya-color-border, #e0e0e0);
    border-radius: var(--sanjaya-radius-sm, 4px);
    font-family: inherit;
    font-size: var(--sanjaya-font-size-sm, 0.8125rem);
    cursor: pointer;
    background: var(--sanjaya-color-surface, #ffffff);
    color: var(--sanjaya-color-on-surface, #212121);
    transition: background var(--sanjaya-transition-fast, 120ms ease-in-out),
                border-color var(--sanjaya-transition-fast, 120ms ease-in-out);
  }

  .btn:hover {
    background: var(--sanjaya-color-surface-variant, #f5f5f5);
    border-color: var(--sanjaya-color-border-hover, #bdbdbd);
  }

  .btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--sanjaya-color-focus-ring, rgba(25, 118, 210, 0.3));
  }

  .btn-primary {
    background: var(--sanjaya-color-primary, #1976d2);
    color: var(--sanjaya-color-primary-text, #ffffff);
    border-color: var(--sanjaya-color-primary, #1976d2);
  }

  .btn-primary:hover {
    background: var(--sanjaya-color-primary-hover, #1565c0);
    border-color: var(--sanjaya-color-primary-hover, #1565c0);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
    pointer-events: none;
  }

  .dirty-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--sanjaya-color-warning, #ed6c02);
    margin-left: var(--sanjaya-spacing-xs, 4px);
    vertical-align: middle;
  }
</style>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">
      Columns
      <span class="dirty-dot" id="dirty-indicator" hidden></span>
    </span>
    <div class="panel-actions">
      <button class="btn" id="btn-undo" disabled title="Discard changes">Undo</button>
      <button class="btn btn-primary" id="btn-apply" disabled title="Apply selection">Apply</button>
    </div>
  </div>
  <div class="panel-body">
    <div class="toolbar">
      <label class="select-all-label">
        <input type="checkbox" id="select-all" />
        All
      </label>
      <span class="toolbar-spacer"></span>
      <span class="column-count" id="column-count"></span>
    </div>
    <ul class="column-list" id="column-list" role="listbox" aria-label="Columns">
      <!-- items rendered dynamically -->
    </ul>
    <template id="column-item-tpl">
      <li class="column-item" role="option" tabindex="0">
        <span class="drag-handle" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.2"/>
            <circle cx="11" cy="3" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/>
            <circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="13" r="1.2"/>
            <circle cx="11" cy="13" r="1.2"/>
          </svg>
        </span>
        <input type="checkbox" class="column-check" />
        <span class="column-label"></span>
        <span class="group-toggle">
          <span class="group-toggle-label">Group</span>
          <input type="checkbox" class="group-check" title="Use as row group" />
        </span>
      </li>
    </template>
    <div class="empty-state" id="empty-state" hidden>
      <span id="empty-message">No columns available</span>
    </div>
  </div>
</div>
`;

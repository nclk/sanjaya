// AUTO-GENERATED - DO NOT EDIT
// Generated from template.html by @pojagi/build-templates

/**
 * Template HTML for <dataset-picker>
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

  /* ---- Search input ---------------------------------------------------- */

  .search-wrap {
    position: relative;
    margin-bottom: var(--sanjaya-spacing-sm, 8px);
  }

  .search-icon {
    position: absolute;
    left: var(--sanjaya-spacing-sm, 8px);
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: var(--sanjaya-color-on-surface-secondary, #616161);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    box-sizing: border-box;
    padding: var(--sanjaya-spacing-sm, 8px) var(--sanjaya-spacing-sm, 8px) var(--sanjaya-spacing-sm, 8px) calc(var(--sanjaya-spacing-sm, 8px) + 20px);
    border: 1px solid var(--sanjaya-color-border, #e0e0e0);
    border-radius: var(--sanjaya-radius-sm, 4px);
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    background: var(--sanjaya-color-surface, #ffffff);
    outline: none;
    transition: border-color var(--sanjaya-transition-fast, 120ms ease-in-out);
  }

  .search-input:focus {
    border-color: var(--sanjaya-color-primary, #1976d2);
    box-shadow: 0 0 0 2px var(--sanjaya-color-focus-ring, rgba(25, 118, 210, 0.3));
  }

  .search-input::placeholder {
    color: var(--sanjaya-color-disabled, #bdbdbd);
  }

  /* ---- Dataset list ---------------------------------------------------- */

  .dataset-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 240px;
    overflow-y: auto;
  }

  .dataset-item {
    display: flex;
    flex-direction: column;
    padding: var(--sanjaya-spacing-sm, 8px) var(--sanjaya-spacing-md, 12px);
    cursor: pointer;
    border-radius: var(--sanjaya-radius-sm, 4px);
    transition: background var(--sanjaya-transition-fast, 120ms ease-in-out);
    border: 2px solid transparent;
  }

  .dataset-item:hover {
    background: var(--sanjaya-color-surface-variant, #f5f5f5);
  }

  .dataset-item:focus-visible {
    outline: none;
    border-color: var(--sanjaya-color-primary, #1976d2);
    box-shadow: 0 0 0 2px var(--sanjaya-color-focus-ring, rgba(25, 118, 210, 0.3));
  }

  .dataset-item[aria-selected="true"] {
    background: color-mix(in srgb, var(--sanjaya-color-primary, #1976d2) 10%, transparent);
    border-color: var(--sanjaya-color-primary, #1976d2);
  }

  .dataset-item-label {
    font-weight: var(--sanjaya-font-weight-medium, 500);
  }

  .dataset-item-desc {
    font-size: var(--sanjaya-font-size-xs, 0.6875rem);
    color: var(--sanjaya-color-on-surface-secondary, #616161);
    margin-top: var(--sanjaya-spacing-xxs, 2px);
  }

  .dataset-item-badge {
    display: inline-block;
    font-size: var(--sanjaya-font-size-xs, 0.6875rem);
    padding: 1px var(--sanjaya-spacing-xs, 4px);
    border-radius: var(--sanjaya-radius-sm, 4px);
    background: var(--sanjaya-color-info, #0288d1);
    color: #fff;
    margin-left: var(--sanjaya-spacing-xs, 4px);
    vertical-align: middle;
  }

  /* ---- Empty / loading states ------------------------------------------ */

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
      Dataset
      <span class="dirty-dot" id="dirty-indicator" hidden></span>
    </span>
    <div class="panel-actions">
      <button class="btn" id="btn-undo" disabled title="Discard changes">Undo</button>
      <button class="btn btn-primary" id="btn-apply" disabled title="Apply selection">Apply</button>
    </div>
  </div>
  <div class="panel-body">
    <div class="search-wrap">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        class="search-input"
        id="search"
        placeholder="Search datasets…"
        autocomplete="off"
      />
    </div>
    <ul class="dataset-list" id="dataset-list" role="listbox" aria-label="Datasets">
      <!-- items rendered dynamically -->
    </ul>
    <template id="dataset-item-tpl">
      <li class="dataset-item" role="option" tabindex="0">
        <span class="dataset-item-label">
          <span class="dataset-item-name"></span>
          <span class="dataset-item-badge" hidden>pivot</span>
        </span>
        <span class="dataset-item-desc"></span>
      </li>
    </template>
    <div class="empty-state" id="empty-state" hidden>
      <span id="empty-message">No datasets available</span>
    </div>
  </div>
</div>
`;

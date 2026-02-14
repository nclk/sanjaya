// AUTO-GENERATED - DO NOT EDIT
// Generated from template.html by @pojagi/build-templates

/**
 * Template HTML for <pivot-config>
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

  /* ---- Zones layout ---------------------------------------------------- */

  .zones {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--sanjaya-spacing-md, 12px);
  }

  @media (max-width: 640px) {
    .zones {
      grid-template-columns: 1fr;
    }
  }

  /* ---- Empty / disabled state ------------------------------------------ */

  .empty-state {
    text-align: center;
    padding: var(--sanjaya-spacing-xl, 24px);
    color: var(--sanjaya-color-on-surface-secondary, #616161);
    font-size: var(--sanjaya-font-size-sm, 0.8125rem);
  }

  .disabled-state {
    text-align: center;
    padding: var(--sanjaya-spacing-xl, 24px);
    color: var(--sanjaya-color-on-surface-secondary, #616161);
    font-size: var(--sanjaya-font-size-sm, 0.8125rem);
  }
</style>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">
      Pivot
      <span class="dirty-dot" id="dirty-indicator" hidden></span>
    </span>
    <div class="panel-actions">
      <button class="btn" id="btn-undo" disabled>Undo</button>
      <button class="btn btn-primary" id="btn-apply" disabled>Apply</button>
    </div>
  </div>
  <div class="panel-body">
    <div class="zones" id="zones">
      <sj-pivot-zone id="zone-rows"></sj-pivot-zone>
      <sj-pivot-zone id="zone-columns"></sj-pivot-zone>
      <sj-pivot-zone id="zone-values"></sj-pivot-zone>
    </div>
    <div class="empty-state" id="empty-state" hidden>
      Select a dataset to configure pivot layout
    </div>
    <div class="disabled-state" id="disabled-state" hidden>
      Pivot is not supported for this dataset
    </div>
  </div>
</div>
`;

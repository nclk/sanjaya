// AUTO-GENERATED - DO NOT EDIT
// Generated from template.html by @pojagi/build-templates

/**
 * Template HTML for <data-grid>
 * Edit the source template.html file, not this file.
 */
export const template = `<style>
  :host {
    display: block;
    width: 100%;
    height: 100%;
    font-family: var(--sanjaya-font-family, system-ui, sans-serif);
    color: var(--sanjaya-color-on-surface, #333);
  }

  /* ---- Tab bar ---- */
  .tab-bar {
    display: flex;
    align-items: stretch;
    border-bottom: 2px solid var(--sanjaya-color-border, #e0e0e0);
    background: var(--sanjaya-color-surface, #fff);
    padding: 0 var(--sanjaya-spacing-sm, 8px);
    gap: 0;
  }

  .tab-btn {
    appearance: none;
    border: none;
    background: transparent;
    font: inherit;
    font-size: var(--sanjaya-font-size-sm, 0.875rem);
    font-weight: var(--sanjaya-font-weight-medium, 500);
    color: var(--sanjaya-color-on-surface, #333);
    padding: var(--sanjaya-spacing-sm, 8px) var(--sanjaya-spacing-md, 16px);
    cursor: pointer;
    position: relative;
    opacity: 0.65;
    transition: opacity 0.15s ease;
  }

  .tab-btn:hover {
    opacity: 0.85;
  }

  .tab-btn[aria-selected="true"] {
    opacity: 1;
  }

  .tab-btn[aria-selected="true"]::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -2px;
    height: 2px;
    background: var(--sanjaya-color-primary, #1976d2);
  }

  .tab-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  /* ---- Grid panels ---- */
  .grid-panels {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .grid-panel {
    position: absolute;
    inset: 0;
    display: none;
  }

  .grid-panel[data-active] {
    display: block;
  }

  /* ---- Layout wrapper ---- */
  .data-grid-root {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* ---- Empty / loading states ---- */
  .grid-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--sanjaya-color-on-surface, #999);
    opacity: 0.6;
    font-size: var(--sanjaya-font-size-md, 1rem);
  }

  /*
   * Slotted grid containers live in the light DOM so that host-level
   * AG Grid CSS (and any host customisations) apply naturally.
   * We only need to ensure they fill the panel.
   */
  ::slotted([slot="grid-table"]),
  ::slotted([slot="grid-pivot"]) {
    width: 100%;
    height: 100%;
    display: none;
  }

  ::slotted([data-grid-visible]) {
    display: block;
  }
</style>

<div class="data-grid-root">
  <div class="tab-bar" role="tablist">
    <button class="tab-btn" role="tab" data-tab="table" aria-selected="true">Table</button>
    <button class="tab-btn" role="tab" data-tab="pivot" aria-selected="false">Pivot</button>
  </div>

  <div class="grid-panels">
    <div class="grid-panel" id="panel-table" role="tabpanel" data-active>
      <div class="grid-placeholder" id="placeholder-table">
        Select a dataset to view data
      </div>
      <slot name="grid-table"></slot>
    </div>
    <div class="grid-panel" id="panel-pivot" role="tabpanel">
      <div class="grid-placeholder" id="placeholder-pivot">
        Configure pivot settings to view data
      </div>
      <slot name="grid-pivot"></slot>
    </div>
  </div>
</div>
`;

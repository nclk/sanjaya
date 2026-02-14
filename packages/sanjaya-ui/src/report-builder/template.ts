// AUTO-GENERATED - DO NOT EDIT
// Generated from template.html by @pojagi/build-templates

/**
 * Template HTML for <report-builder>
 * Edit the source template.html file, not this file.
 */
export const template = `<style>
  :host {
    display: block;
    font-family: var(--sanjaya-font-family, system-ui, sans-serif);
    color: var(--sanjaya-color-on-surface, #333);
  }

  /* ---- Header bar ---- */
  .builder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sanjaya-spacing-sm, 8px) var(--sanjaya-spacing-md, 16px);
    border-bottom: 1px solid var(--sanjaya-color-border, #e0e0e0);
    background: var(--sanjaya-color-surface, #fff);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--sanjaya-spacing-sm, 8px);
    min-width: 0;
  }

  .builder-title {
    font-size: var(--sanjaya-font-size-md, 1rem);
    font-weight: var(--sanjaya-font-weight-bold, 600);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .report-dirty {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sanjaya-color-primary, #1976d2);
    flex-shrink: 0;
  }

  .report-dirty[hidden] {
    display: none;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--sanjaya-spacing-sm, 8px);
    flex-shrink: 0;
  }

  /* ---- Status badge ---- */
  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--sanjaya-radius-sm, 4px);
    font-size: var(--sanjaya-font-size-sm, 0.75rem);
    text-transform: capitalize;
    background: var(--sanjaya-color-border, #e0e0e0);
    color: var(--sanjaya-color-on-surface, #333);
  }

  .status-badge[hidden] {
    display: none;
  }

  /* ---- Panel grid ---- */
  .builder-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sanjaya-spacing-md, 16px);
    padding: var(--sanjaya-spacing-md, 16px);
  }

  @media (min-width: 900px) {
    .builder-body {
      grid-template-columns: 280px 1fr;
      grid-template-rows: auto auto auto;
    }

    .panel-dataset {
      grid-column: 1;
      grid-row: 1;
    }

    .panel-columns {
      grid-column: 1;
      grid-row: 2 / 4;
    }

    .panel-filter {
      grid-column: 2;
      grid-row: 1 / 3;
    }

    .panel-pivot {
      grid-column: 2;
      grid-row: 3;
    }
  }

  /* ---- Individual panels ---- */
  .panel {
    border: 1px solid var(--sanjaya-color-border, #e0e0e0);
    border-radius: var(--sanjaya-radius-md, 6px);
    background: var(--sanjaya-color-surface, #fff);
    overflow: hidden;
  }

  /* ---- No-client state ---- */
  .no-client-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanjaya-spacing-xl, 48px);
    color: var(--sanjaya-color-on-surface, #999);
    font-style: italic;
    text-align: center;
  }

  .no-client-state[hidden] {
    display: none;
  }

  .builder-body[hidden] {
    display: none;
  }
</style>

<!-- Header -->
<header class="builder-header">
  <div class="header-left">
    <h2 id="builder-title" class="builder-title">New Report</h2>
    <span id="report-dirty" class="report-dirty" hidden title="Unsaved changes"></span>
    <span id="status-badge" class="status-badge" hidden></span>
  </div>
  <div class="header-right">
    <sj-actions-menu id="actions-menu"></sj-actions-menu>
  </div>
</header>

<!-- No client fallback -->
<div id="no-client-state" class="no-client-state" hidden>
  Set the <code>client</code> property to begin.
</div>

<!-- Panel grid -->
<div id="builder-body" class="builder-body" hidden>
  <div class="panel panel-dataset">
    <sj-dataset-picker id="dataset-picker"></sj-dataset-picker>
  </div>
  <div class="panel panel-columns">
    <sj-column-selector id="column-selector"></sj-column-selector>
  </div>
  <div class="panel panel-filter">
    <sj-filter-builder id="filter-builder"></sj-filter-builder>
  </div>
  <div class="panel panel-pivot">
    <sj-pivot-config id="pivot-config"></sj-pivot-config>
  </div>
</div>
`;

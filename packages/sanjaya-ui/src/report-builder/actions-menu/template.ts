// AUTO-GENERATED - DO NOT EDIT
// Generated from template.html by @pojagi/build-templates

/**
 * Template HTML for <actions-menu>
 * Edit the source template.html file, not this file.
 */
export const template = `<style>
  :host {
    display: inline-block;
    position: relative;
    font-family: var(--sanjaya-font-family, system-ui, sans-serif);
    font-size: var(--sanjaya-font-size-sm, 0.875rem);
  }

  .menu-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--sanjaya-spacing-xs, 4px);
    padding: var(--sanjaya-spacing-xs, 4px) var(--sanjaya-spacing-sm, 8px);
    border: 1px solid var(--sanjaya-color-border, #ccc);
    border-radius: var(--sanjaya-radius-sm, 4px);
    background: var(--sanjaya-color-surface, #fff);
    color: var(--sanjaya-color-on-surface, #333);
    cursor: pointer;
    font: inherit;
    line-height: 1.5;
  }

  .menu-trigger:hover {
    background: var(--sanjaya-color-primary-hover, #f0f0f0);
  }

  .menu-trigger:focus-visible {
    outline: 2px solid var(--sanjaya-color-primary, #1976d2);
    outline-offset: 1px;
  }

  .menu-trigger .caret {
    font-size: 0.6em;
    margin-left: 2px;
  }

  /* Dropdown panel */
  .menu-panel {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 100;
    min-width: 200px;
    margin-top: 4px;
    padding: var(--sanjaya-spacing-xs, 4px) 0;
    border: 1px solid var(--sanjaya-color-border, #ccc);
    border-radius: var(--sanjaya-radius-md, 6px);
    background: var(--sanjaya-color-surface, #fff);
    box-shadow: var(--sanjaya-elevation-2, 0 4px 12px rgba(0,0,0,0.15));
    list-style: none;
  }

  .menu-panel[hidden] {
    display: none;
  }

  /* Menu items */
  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--sanjaya-spacing-xs, 6px) var(--sanjaya-spacing-md, 16px);
    border: none;
    background: none;
    color: var(--sanjaya-color-on-surface, #333);
    cursor: pointer;
    font: inherit;
    text-align: left;
    white-space: nowrap;
  }

  .menu-item:hover:not(:disabled) {
    background: var(--sanjaya-color-primary-hover, #f0f0f0);
  }

  .menu-item:focus-visible {
    outline: 2px solid var(--sanjaya-color-primary, #1976d2);
    outline-offset: -2px;
  }

  .menu-item:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .menu-item.danger {
    color: var(--sanjaya-color-error, #d32f2f);
  }

  .menu-separator {
    height: 0;
    margin: var(--sanjaya-spacing-xs, 4px) 0;
    border: none;
    border-top: 1px solid var(--sanjaya-color-border, #e0e0e0);
  }
</style>

<button id="menu-trigger" class="menu-trigger" aria-haspopup="true" aria-expanded="false">
  Actions <span class="caret">▾</span>
</button>

<ul id="menu-panel" class="menu-panel" role="menu" hidden></ul>
`;

// ---------------------------------------------------------------------------
// <sj-actions-menu> — dropdown actions menu
//
// Renders a list of MenuActionItems as a dropdown menu. Emits
// `action-select` when the user clicks an enabled item.
// ---------------------------------------------------------------------------

import { emit } from "../../shared/events.js";
import { template } from "./template.js";
import type { MenuActionItem, MenuAction } from "../helpers.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Event detail
// ---------------------------------------------------------------------------

export interface ActionSelectDetail {
  action: MenuAction;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-actions-menu>` — dropdown button that renders action items.
 *
 * @fires action-select — Emitted when the user clicks an enabled menu item.
 */
export class SanjayaActionsMenu extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  /** The list of menu items to render. */
  get items(): MenuActionItem[] {
    return this._items;
  }

  set items(value: MenuActionItem[]) {
    this._items = value;
    this._render();
  }

  // ----- Private state ----------------------------------------------------

  private _items: MenuActionItem[] = [];
  private _open = false;

  // Shadow DOM refs
  private _root: ShadowRoot;
  private _triggerEl: HTMLButtonElement;
  private _panelEl: HTMLUListElement;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._triggerEl = this._root.getElementById(
      "menu-trigger",
    ) as HTMLButtonElement;
    this._panelEl = this._root.getElementById(
      "menu-panel",
    ) as HTMLUListElement;
  }

  connectedCallback(): void {
    this._triggerEl.addEventListener("click", this._onTriggerClick);
    this._panelEl.addEventListener("click", this._onItemClick);
    document.addEventListener("click", this._onDocumentClick);
    this._panelEl.addEventListener("keydown", this._onKeydown);
  }

  disconnectedCallback(): void {
    this._triggerEl.removeEventListener("click", this._onTriggerClick);
    this._panelEl.removeEventListener("click", this._onItemClick);
    document.removeEventListener("click", this._onDocumentClick);
    this._panelEl.removeEventListener("keydown", this._onKeydown);
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private _render(): void {
    this._panelEl.innerHTML = "";

    for (const item of this._items) {
      if (item.separator) {
        const sep = document.createElement("li");
        sep.className = "menu-separator";
        sep.setAttribute("role", "separator");
        this._panelEl.appendChild(sep);
      }

      const li = document.createElement("li");
      li.setAttribute("role", "none");

      const btn = document.createElement("button");
      btn.className = "menu-item";
      if (item.danger) btn.classList.add("danger");
      btn.setAttribute("role", "menuitem");
      btn.dataset.action = item.action;
      btn.textContent = item.label;
      btn.disabled = !item.enabled;

      li.appendChild(btn);
      this._panelEl.appendChild(li);
    }
  }

  // -----------------------------------------------------------------------
  // Open / Close
  // -----------------------------------------------------------------------

  private _toggle(): void {
    this._open ? this._close() : this._openMenu();
  }

  private _openMenu(): void {
    this._open = true;
    this._panelEl.hidden = false;
    this._triggerEl.setAttribute("aria-expanded", "true");

    // Focus first enabled item
    const first = this._panelEl.querySelector<HTMLButtonElement>(
      ".menu-item:not(:disabled)",
    );
    first?.focus();
  }

  private _close(): void {
    this._open = false;
    this._panelEl.hidden = true;
    this._triggerEl.setAttribute("aria-expanded", "false");
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onTriggerClick = (e: Event): void => {
    e.stopPropagation();
    this._toggle();
  };

  private _onItemClick = (e: Event): void => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      ".menu-item",
    );
    if (!btn || btn.disabled) return;

    const action = btn.dataset.action as MenuAction;
    emit<ActionSelectDetail>(this, "action-select", { action });
    this._close();
  };

  /** Close the menu when clicking outside. */
  private _onDocumentClick = (): void => {
    if (this._open) {
      this._close();
    }
  };

  /** Keyboard navigation within the open menu. */
  private _onKeydown = (e: KeyboardEvent): void => {
    const items = Array.from(
      this._panelEl.querySelectorAll<HTMLButtonElement>(
        ".menu-item:not(:disabled)",
      ),
    );
    const current = this._root.activeElement as HTMLElement | null;
    const idx = current ? items.indexOf(current as HTMLButtonElement) : -1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
        break;
      case "Escape":
        e.preventDefault();
        this._close();
        this._triggerEl.focus();
        break;
      case "Home":
        e.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
    }
  };
}

customElements.define("sj-actions-menu", SanjayaActionsMenu);

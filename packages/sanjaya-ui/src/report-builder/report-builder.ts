// ---------------------------------------------------------------------------
// <sj-report-builder> — top-level orchestrator
//
// Composes dataset-picker, column-selector, filter-builder, pivot-config,
// and actions-menu into a coherent report builder shell.
//
// Two-tier dirty state:
//   1. Panel-level — each child owns a DirtyTracker (Apply / Undo per panel)
//   2. Report-level — applied state vs. last-saved snapshot
// ---------------------------------------------------------------------------

import type { SanjayaDataClient } from "../types/client.js";
import type {
  DynamicReport,
  DynamicReportDefinition,
  DynamicReportAction,
} from "../types/reports.js";
import type { DatasetCapabilities } from "../types/datasets.js";
import { emptyFilterGroup } from "../types/filters.js";
import { emit } from "../shared/events.js";
import { template } from "./template.js";

// Import child components (side-effect: registers custom elements)
import "../dataset-picker/dataset-picker.js";
import "../column-selector/column-selector.js";
import "../filter-builder/filter-builder.js";
import "../pivot-config/pivot-config.js";
import "./actions-menu/actions-menu.js";

import type { SanjayaDatasetPicker } from "../dataset-picker/dataset-picker.js";
import type { DatasetChangeDetail } from "../dataset-picker/dataset-picker.js";
import type { SanjayaColumnSelector } from "../column-selector/column-selector.js";
import type { ColumnsChangeDetail } from "../column-selector/column-selector.js";
import type { SanjayaFilterBuilder } from "../filter-builder/filter-builder.js";
import type { FilterChangeDetail } from "../filter-builder/filter-builder.js";
import type { SanjayaPivotConfig } from "../pivot-config/pivot-config.js";
import type { PivotConfigChangeDetail } from "../pivot-config/pivot-config.js";
import type { SanjayaActionsMenu } from "./actions-menu/actions-menu.js";
import type { ActionSelectDetail } from "./actions-menu/actions-menu.js";

import type { ReportBuilderState } from "./helpers.js";
import {
  emptyBuilderState,
  stateToDefinition,
  definitionToState,
  buildActionMenu,
  hasNonDefaultState,
  isReportDirty,
} from "./helpers.js";
import { emptyPivotConfig } from "../pivot-config/helpers.js";

const tpl = document.createElement("template");
tpl.innerHTML = template;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Detail payload for `report-definition-change`. */
export type ReportDefinitionChangeDetail = DynamicReportDefinition | null;

/** Detail payload for `report-action`. */
export interface ReportActionDetail {
  action: DynamicReportAction | string;
  report: DynamicReport | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<sj-report-builder>` — top-level orchestrator.
 *
 * @fires report-definition-change — Emitted whenever applied state changes.
 * @fires report-action — Emitted when a lifecycle action is requested.
 */
export class SanjayaReportBuilder extends HTMLElement {
  // ----- Public properties ------------------------------------------------

  get client(): SanjayaDataClient | null {
    return this._client;
  }

  set client(value: SanjayaDataClient | null) {
    this._client = value;
    this._injectClient();
    this._updateUI();
  }

  get reportId(): string | null {
    return this._reportId;
  }

  set reportId(value: string | null) {
    if (value === this._reportId) return;
    this._reportId = value;
    if (value && this._client) {
      this._loadReport(value);
    }
  }

  /** Current applied state as a report definition (read-only). */
  getReportDefinition(): DynamicReportDefinition | null {
    return stateToDefinition(this._state);
  }

  /** The loaded report object (null for unsaved). */
  get report(): DynamicReport | null {
    return this._report;
  }

  /** Whether the report has unsaved changes (report-level dirty). */
  get dirty(): boolean {
    return this._reportDirty;
  }

  /** Optional callbacks — alternative to addEventListener. */
  onReportDefinitionChange?: (detail: ReportDefinitionChangeDetail) => void;
  onReportAction?: (detail: ReportActionDetail) => void;

  // ----- Private state ----------------------------------------------------

  private _client: SanjayaDataClient | null = null;
  private _reportId: string | null = null;
  private _report: DynamicReport | null = null;
  private _state: ReportBuilderState = emptyBuilderState();
  private _savedSnapshot: ReportBuilderState | null = null;
  private _reportDirty = false;
  private _capabilities: DatasetCapabilities = { pivot: false };

  // Shadow DOM refs
  private _root: ShadowRoot;
  private _titleEl: HTMLElement;
  private _reportDirtyDot: HTMLElement;
  private _statusBadge: HTMLElement;
  private _noClientState: HTMLElement;
  private _builderBody: HTMLElement;

  private _datasetPicker: SanjayaDatasetPicker;
  private _columnSelector: SanjayaColumnSelector;
  private _filterBuilder: SanjayaFilterBuilder;
  private _pivotConfig: SanjayaPivotConfig;
  private _actionsMenu: SanjayaActionsMenu;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  constructor() {
    super();

    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(tpl.content.cloneNode(true));

    this._titleEl = this._root.getElementById("builder-title")!;
    this._reportDirtyDot = this._root.getElementById("report-dirty")!;
    this._statusBadge = this._root.getElementById("status-badge")!;
    this._noClientState = this._root.getElementById("no-client-state")!;
    this._builderBody = this._root.getElementById("builder-body")!;

    this._datasetPicker = this._root.getElementById(
      "dataset-picker",
    ) as unknown as SanjayaDatasetPicker;
    this._columnSelector = this._root.getElementById(
      "column-selector",
    ) as unknown as SanjayaColumnSelector;
    this._filterBuilder = this._root.getElementById(
      "filter-builder",
    ) as unknown as SanjayaFilterBuilder;
    this._pivotConfig = this._root.getElementById(
      "pivot-config",
    ) as unknown as SanjayaPivotConfig;
    this._actionsMenu = this._root.getElementById(
      "actions-menu",
    ) as unknown as SanjayaActionsMenu;
  }

  connectedCallback(): void {
    // Listen for child "applied" events
    this._datasetPicker.addEventListener(
      "dataset-change",
      this._onDatasetChange,
    );
    this._columnSelector.addEventListener(
      "columns-change",
      this._onColumnsChange,
    );
    this._filterBuilder.addEventListener(
      "filter-change",
      this._onFilterChange,
    );
    this._pivotConfig.addEventListener(
      "pivot-config-change",
      this._onPivotConfigChange,
    );
    this._actionsMenu.addEventListener(
      "action-select",
      this._onActionSelect,
    );

    this._injectClient();
    this._updateUI();

    if (this._reportId && this._client) {
      this._loadReport(this._reportId);
    }
  }

  disconnectedCallback(): void {
    this._datasetPicker.removeEventListener(
      "dataset-change",
      this._onDatasetChange,
    );
    this._columnSelector.removeEventListener(
      "columns-change",
      this._onColumnsChange,
    );
    this._filterBuilder.removeEventListener(
      "filter-change",
      this._onFilterChange,
    );
    this._pivotConfig.removeEventListener(
      "pivot-config-change",
      this._onPivotConfigChange,
    );
    this._actionsMenu.removeEventListener(
      "action-select",
      this._onActionSelect,
    );
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Programmatically load a report from a `DynamicReport` object.
   * Does **not** call the client — assumes the caller already has the data.
   */
  loadReport(report: DynamicReport): void {
    this._report = report;
    this._reportId = String(report.id);
    const def = report.metadata?.definition;
    if (def) {
      this._state = definitionToState(def);
      this._savedSnapshot = structuredClone(this._state);
      this._hydrateChildren();
    }
    this._updateReportDirty();
    this._updateUI();
  }

  /** Reset to a blank state (new report). */
  clearAll(): void {
    this._report = null;
    this._reportId = null;
    this._state = emptyBuilderState();
    this._savedSnapshot = null;
    this._capabilities = { pivot: false };
    this._hydrateChildren();
    this._updateReportDirty();
    this._updateUI();
  }

  // -----------------------------------------------------------------------
  // Client injection
  // -----------------------------------------------------------------------

  private _injectClient(): void {
    if (!this._client) return;
    this._datasetPicker.client = this._client;
    this._columnSelector.client = this._client;
    this._filterBuilder.client = this._client;
    this._pivotConfig.client = this._client;
  }

  // -----------------------------------------------------------------------
  // Report loading
  // -----------------------------------------------------------------------

  private async _loadReport(reportId: string): Promise<void> {
    if (!this._client) return;

    try {
      const report = await this._client.getReport(reportId);
      this.loadReport(report);
    } catch {
      // Failed to load — stay on blank state
    }
  }

  // -----------------------------------------------------------------------
  // Child event handlers — update applied state
  // -----------------------------------------------------------------------

  private _onDatasetChange = (e: Event): void => {
    const { key, capabilities } = (
      e as CustomEvent<DatasetChangeDetail>
    ).detail;

    const datasetChanged = key !== this._state.datasetKey;
    this._state.datasetKey = key;
    this._capabilities = capabilities;

    if (datasetChanged) {
      // Reset downstream panels
      this._state.columns = { columns: [] };
      this._state.filter = emptyFilterGroup();
      this._state.pivotConfig = emptyPivotConfig();

      this._columnSelector.datasetKey = key;
      this._filterBuilder.datasetKey = key;
      this._pivotConfig.datasetKey = key;
      this._pivotConfig.disabled = !capabilities.pivot;
    }

    this._updateReportDirty();
    this._emitDefinitionChange();
    this._updateUI();
  };

  private _onColumnsChange = (e: Event): void => {
    this._state.columns = (
      e as CustomEvent<ColumnsChangeDetail>
    ).detail;
    this._updateReportDirty();
    this._emitDefinitionChange();
    this._updateUI();
  };

  private _onFilterChange = (e: Event): void => {
    this._state.filter = (
      e as CustomEvent<FilterChangeDetail>
    ).detail;
    this._updateReportDirty();
    this._emitDefinitionChange();
    this._updateUI();
  };

  private _onPivotConfigChange = (e: Event): void => {
    this._state.pivotConfig = (
      e as CustomEvent<PivotConfigChangeDetail>
    ).detail;
    this._updateReportDirty();
    this._emitDefinitionChange();
    this._updateUI();
  };

  // -----------------------------------------------------------------------
  // Actions menu
  // -----------------------------------------------------------------------

  private _onActionSelect = async (e: Event): Promise<void> => {
    const { action } = (e as CustomEvent<ActionSelectDetail>).detail;

    switch (action) {
      case "save":
        await this._save();
        break;

      case "saveAs":
        await this._saveAs();
        break;

      case "reset":
        this._resetToSaved();
        break;

      case "clearAll":
        this.clearAll();
        break;

      case "export":
        emit<ReportActionDetail>(this, "report-action", {
          action: "export",
          report: this._report,
        });
        break;

      default:
        // Server lifecycle action — forward to the client
        await this._performAction(action as DynamicReportAction);
        break;
    }
  };

  // -----------------------------------------------------------------------
  // Save operations
  // -----------------------------------------------------------------------

  private async _save(): Promise<void> {
    if (!this._client) return;
    const def = this.getReportDefinition();
    if (!def) return;

    try {
      let report: DynamicReport;
      if (this._report) {
        report = await this._client.updateReport(String(this._report.id), {
          metadata: { definition: def },
        });
      } else {
        report = await this._client.createReport({
          title: "Untitled Report",
          metadata: { definition: def },
        });
      }
      this._report = report;
      this._reportId = String(report.id);
      this._savedSnapshot = structuredClone(this._state);
      this._updateReportDirty();
      this._updateUI();
    } catch {
      // Save failed — state unchanged; host should handle error via
      // the client implementation
    }
  }

  private async _saveAs(): Promise<void> {
    if (!this._client) return;
    const def = this.getReportDefinition();
    if (!def) return;

    try {
      const report = await this._client.createReport({
        title: this._report
          ? `${this._report.title} (copy)`
          : "Untitled Report",
        metadata: { definition: def },
      });
      this._report = report;
      this._reportId = String(report.id);
      this._savedSnapshot = structuredClone(this._state);
      this._updateReportDirty();
      this._updateUI();
    } catch {
      // Save As failed
    }
  }

  private _resetToSaved(): void {
    if (this._savedSnapshot) {
      this._state = structuredClone(this._savedSnapshot);
      this._hydrateChildren();
    } else {
      this.clearAll();
    }
    this._updateReportDirty();
    this._emitDefinitionChange();
    this._updateUI();
  }

  private async _performAction(
    action: DynamicReportAction,
  ): Promise<void> {
    if (!this._client || !this._report) return;

    try {
      const updated = await this._client.performAction(
        String(this._report.id),
        action,
      );
      this._report = updated;
      emit<ReportActionDetail>(this, "report-action", {
        action,
        report: updated,
      });
      this._updateUI();
    } catch {
      // Action failed
    }
  }

  // -----------------------------------------------------------------------
  // Hydrate children from state
  // -----------------------------------------------------------------------

  private _hydrateChildren(): void {
    if (this._state.datasetKey) {
      this._datasetPicker.setAppliedValue(this._state.datasetKey);
      this._columnSelector.datasetKey = this._state.datasetKey;
      this._columnSelector.setAppliedValue(this._state.columns);
      this._filterBuilder.datasetKey = this._state.datasetKey;
      this._filterBuilder.setAppliedValue(this._state.filter);
      this._pivotConfig.datasetKey = this._state.datasetKey;
      this._pivotConfig.setAppliedValue(this._state.pivotConfig);
      this._pivotConfig.disabled = !this._capabilities.pivot;
    } else {
      this._datasetPicker.setAppliedValue(null);
    }
  }

  // -----------------------------------------------------------------------
  // Report-level dirty state
  // -----------------------------------------------------------------------

  private _updateReportDirty(): void {
    this._reportDirty = isReportDirty(
      this._state,
      this._savedSnapshot,
    );
  }

  private _emitDefinitionChange(): void {
    const def = this.getReportDefinition();
    emit<ReportDefinitionChangeDetail>(
      this,
      "report-definition-change",
      def,
    );
  }

  // -----------------------------------------------------------------------
  // UI update
  // -----------------------------------------------------------------------

  private _updateUI(): void {
    // Client presence
    const hasClient = this._client !== null;
    this._noClientState.hidden = hasClient;
    this._builderBody.hidden = !hasClient;

    // Title
    this._titleEl.textContent = this._report?.title ?? "New Report";

    // Status badge
    if (this._report) {
      this._statusBadge.textContent = this._report.status;
      this._statusBadge.hidden = false;
    } else {
      this._statusBadge.hidden = true;
    }

    // Report-level dirty dot
    this._reportDirtyDot.hidden = !this._reportDirty;

    // Actions menu
    this._actionsMenu.items = buildActionMenu(
      this._report,
      this._reportDirty,
      this._state.datasetKey !== null,
      hasNonDefaultState(this._state),
    );
  }
}

customElements.define("sj-report-builder", SanjayaReportBuilder);

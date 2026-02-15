/**
 * ReportBuilder — top-level orchestrator that composes all Sanjaya UI
 * widgets into a complete report builder experience.
 *
 * Layout: MUI sidebar (Drawer) with dataset picker, column selector,
 * filter builder, and pivot configurator. Main area has the DataGrid.
 * Toolbar has save, export, and actions menu.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Toolbar from "@mui/material/Toolbar";
import AppBar from "@mui/material/AppBar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveIcon from "@mui/icons-material/Save";
import DownloadIcon from "@mui/icons-material/Download";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import PublishIcon from "@mui/icons-material/Publish";
import ArchiveIcon from "@mui/icons-material/Archive";
import RestoreIcon from "@mui/icons-material/Restore";
import ShareIcon from "@mui/icons-material/Share";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";

import { useSanjayaClient } from "../providers/SanjayaProvider";
import { DatasetPicker } from "./DatasetPicker";
import { ColumnSelector } from "./ColumnSelector";
import { FilterBuilder } from "./FilterBuilder";
import { PivotConfigurator } from "./PivotConfigurator";
import { DataGrid } from "./DataGrid";
import {
  reportBuilderReducer,
  initialState,
  isDirty,
  type ActiveTab,
  type SavedSnapshot,
  emptyFilterGroup,
} from "../state/reportBuilderState";
import type {
  ColumnVO,
  DynamicReport,
  DynamicReportAction,
  ExportFormat,
  FilterGroup,
  SortModelItem,
} from "../api/types";

// ─── Props ───────────────────────────────────────────────────────────

export interface ReportBuilderProps {
  /** Report to load (edit mode). If omitted, starts as a new report. */
  report?: DynamicReport;
  /** Called after a successful save (create or update). */
  onSaved?: (report: DynamicReport) => void;
  /** Called after a successful delete. */
  onDeleted?: () => void;
  /** Sidebar width */
  sidebarWidth?: number;
}

const SIDEBAR_WIDTH = 320;

const ACTION_ICONS: Partial<Record<DynamicReportAction, React.ReactNode>> = {
  edit: <EditIcon fontSize="small" />,
  publish: <PublishIcon fontSize="small" />,
  unpublish: <PublishIcon fontSize="small" />,
  archive: <ArchiveIcon fontSize="small" />,
  restore: <RestoreIcon fontSize="small" />,
  share: <ShareIcon fontSize="small" />,
  favorite: <StarBorderIcon fontSize="small" />,
  transferOwnership: <SwapHorizIcon fontSize="small" />,
  delete: <DeleteIcon fontSize="small" />,
};

const ACTION_LABELS: Record<DynamicReportAction, string> = {
  edit: "Edit",
  publish: "Publish",
  unpublish: "Unpublish",
  archive: "Archive",
  restore: "Restore",
  share: "Share",
  favorite: "Favorite",
  transferOwnership: "Transfer Ownership",
  delete: "Delete",
};

// ─── Component ───────────────────────────────────────────────────────

export function ReportBuilder({
  report,
  onSaved,
  onDeleted,
  sidebarWidth = SIDEBAR_WIDTH,
}: ReportBuilderProps) {
  const client = useSanjayaClient();
  const [state, dispatch] = useReducer(reportBuilderReducer, initialState);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [snackbar, setSnackbar] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const [currentReport, setCurrentReport] = useState<DynamicReport | undefined>(
    report,
  );

  const dirty = isDirty(state);

  // ── Load report definition on mount ───────────────────────────

  useEffect(() => {
    if (report?.metadata?.definition) {
      const def = report.metadata.definition;
      const snapshot: SavedSnapshot = {
        datasetKey: def.datasetKey,
        selectedColumns: def.selectedColumns,
        filterGroup: def.filter ?? emptyFilterGroup,
        rowGroupCols: def.rowGroupCols ?? [],
        pivotCols: def.pivotCols ?? [],
        valueCols: def.valueCols ?? [],
        sortModel: def.sortModel ?? [],
      };
      dispatch({ type: "LOAD_DEFINITION", snapshot });

      // Fetch columns for the loaded dataset
      if (def.datasetKey) {
        dispatch({ type: "SET_LOADING", key: "columns", value: true });
        client
          .getColumns(def.datasetKey)
          .then((res) => dispatch({ type: "SET_COLUMNS", columns: res.columns }))
          .catch((err) =>
            dispatch({ type: "SET_ERROR", error: String(err) }),
          )
          .finally(() =>
            dispatch({ type: "SET_LOADING", key: "columns", value: false }),
          );
      }
    }
  }, [report, client]);

  // ── Load datasets ─────────────────────────────────────────────

  useEffect(() => {
    dispatch({ type: "SET_LOADING", key: "datasets", value: true });
    client
      .listDatasets()
      .then((res) => dispatch({ type: "SET_DATASETS", datasets: res.datasets }))
      .catch((err) => dispatch({ type: "SET_ERROR", error: String(err) }))
      .finally(() =>
        dispatch({ type: "SET_LOADING", key: "datasets", value: false }),
      );
  }, [client]);

  // ── Dataset change → load columns ────────────────────────────

  const handleDatasetChange = useCallback(
    (datasetKey: string | null) => {
      dispatch({ type: "SET_DATASET_KEY", datasetKey });
      if (datasetKey) {
        dispatch({ type: "SET_LOADING", key: "columns", value: true });
        client
          .getColumns(datasetKey)
          .then((res) => {
            dispatch({ type: "SET_COLUMNS", columns: res.columns });
            // Auto-select all columns
            dispatch({
              type: "SET_SELECTED_COLUMNS",
              selectedColumns: res.columns.map((c) => c.name),
            });
          })
          .catch((err) =>
            dispatch({ type: "SET_ERROR", error: String(err) }),
          )
          .finally(() =>
            dispatch({ type: "SET_LOADING", key: "columns", value: false }),
          );
      }
    },
    [client],
  );

  // ── Save ──────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!state.datasetKey) return;
    setSaving(true);

    const definition = {
      datasetKey: state.datasetKey,
      selectedColumns: state.selectedColumns,
      filter: state.filterGroup,
      rowGroupCols:
        state.rowGroupCols.length > 0 ? state.rowGroupCols : undefined,
      pivotCols: state.pivotCols.length > 0 ? state.pivotCols : undefined,
      valueCols: state.valueCols.length > 0 ? state.valueCols : undefined,
      sortModel: state.sortModel.length > 0 ? state.sortModel : undefined,
    };

    try {
      let saved: DynamicReport;
      if (currentReport) {
        saved = await client.updateReport(currentReport.id, {
          metadata: {
            datasetKey: state.datasetKey,
            definition,
          },
        });
      } else {
        saved = await client.createReport({
          title: "Untitled Report",
          metadata: {
            datasetKey: state.datasetKey,
            definition,
          },
        });
      }

      setCurrentReport(saved);
      dispatch({ type: "MARK_SAVED" });
      setSnackbar({ message: "Report saved", severity: "success" });
      onSaved?.(saved);
    } catch (err) {
      setSnackbar({
        message: `Save failed: ${err}`,
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [state, currentReport, client, onSaved]);

  // ── Export ────────────────────────────────────────────────────

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!state.datasetKey) return;

      try {
        let body;
        if (
          state.activeTab === "pivot" &&
          state.pivotCols.length > 0
        ) {
          body = {
            pivot: {
              rowGroupCols: state.rowGroupCols,
              valueCols: state.valueCols,
              pivotCols: state.pivotCols,
              sortModel:
                state.sortModel.length > 0 ? state.sortModel : undefined,
              format,
            },
          };
        } else if (state.rowGroupCols.length > 0) {
          body = {
            grouped: {
              rowGroupCols: state.rowGroupCols,
              valueCols: state.valueCols,
              sortModel:
                state.sortModel.length > 0 ? state.sortModel : undefined,
              format,
            },
          };
        } else {
          body = {
            flat: {
              selectedColumns: state.selectedColumns,
              filter:
                state.filterGroup.conditions.length > 0
                  ? state.filterGroup
                  : undefined,
              format,
            },
          };
        }

        const blob = await client.exportData(state.datasetKey, body);

        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setSnackbar({
          message: `Export failed: ${err}`,
          severity: "error",
        });
      }
    },
    [state, client],
  );

  // ── Actions ───────────────────────────────────────────────────

  const availableActions = currentReport?.availableActions ?? [];

  const handleAction = useCallback(
    async (action: DynamicReportAction) => {
      setActionsAnchor(null);
      if (!currentReport) return;

      try {
        const result = await client.performAction(currentReport.id, {
          action,
        });
        setCurrentReport(result.report);
        setSnackbar({ message: result.message, severity: "success" });

        if (action === "delete") {
          onDeleted?.();
        }
      } catch (err) {
        setSnackbar({
          message: `Action failed: ${err}`,
          severity: "error",
        });
      }
    },
    [currentReport, client, onDeleted],
  );

  // ── Pivot capable? ────────────────────────────────────────────

  const currentDataset = useMemo(
    () => state.datasets.find((d) => d.key === state.datasetKey),
    [state.datasets, state.datasetKey],
  );
  const pivotCapable = currentDataset?.capabilities.pivot ?? false;

  // ── Dispatch helpers ──────────────────────────────────────────

  const setSelectedColumns = useCallback(
    (sc: string[]) => dispatch({ type: "SET_SELECTED_COLUMNS", selectedColumns: sc }),
    [],
  );
  const setFilterGroup = useCallback(
    (fg: FilterGroup) => dispatch({ type: "SET_FILTER_GROUP", filterGroup: fg }),
    [],
  );
  const setRowGroupCols = useCallback(
    (cols: ColumnVO[]) => dispatch({ type: "SET_ROW_GROUP_COLS", rowGroupCols: cols }),
    [],
  );
  const setPivotCols = useCallback(
    (cols: ColumnVO[]) => dispatch({ type: "SET_PIVOT_COLS", pivotCols: cols }),
    [],
  );
  const setValueCols = useCallback(
    (cols: ColumnVO[]) => dispatch({ type: "SET_VALUE_COLS", valueCols: cols }),
    [],
  );
  const setSortModel = useCallback(
    (sm: SortModelItem[]) => dispatch({ type: "SET_SORT_MODEL", sortModel: sm }),
    [],
  );
  const setActiveTab = useCallback(
    (tab: ActiveTab) => dispatch({ type: "SET_ACTIVE_TAB", activeTab: tab }),
    [],
  );

  // ── Render ────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Sidebar */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={sidebarOpen}
        sx={{
          width: sidebarOpen ? sidebarWidth : 0,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: sidebarWidth,
            position: "relative",
            boxSizing: "border-box",
          },
        }}
      >
        <Box sx={{ p: 1.5, overflow: "auto" }}>
          {/* Dataset picker */}
          <Box sx={{ mb: 2 }}>
            <DatasetPicker
              value={state.datasetKey}
              onChange={handleDatasetChange}
              datasets={state.datasets}
              disabled={state.loading.datasets}
            />
          </Box>

          {state.loading.columns ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            state.datasetKey && (
              <>
                {/* Column selector */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">Columns</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <ColumnSelector
                      columns={state.columns}
                      selectedColumns={state.selectedColumns}
                      onChange={setSelectedColumns}
                    />
                  </AccordionDetails>
                </Accordion>

                {/* Filter builder */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">
                      Filters
                      {state.filterGroup.conditions.length > 0 && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="primary"
                          sx={{ ml: 1 }}
                        >
                          ({state.filterGroup.conditions.length})
                        </Typography>
                      )}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FilterBuilder
                      columns={state.columns}
                      filterGroup={state.filterGroup}
                      onChange={setFilterGroup}
                    />
                  </AccordionDetails>
                </Accordion>

                {/* Pivot configurator */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">
                      Grouping & Pivot
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <PivotConfigurator
                      columns={state.columns}
                      rowGroupCols={state.rowGroupCols}
                      pivotCols={state.pivotCols}
                      valueCols={state.valueCols}
                      onRowGroupColsChange={setRowGroupCols}
                      onPivotColsChange={setPivotCols}
                      onValueColsChange={setValueCols}
                      hidePivotZone={!pivotCapable}
                    />
                  </AccordionDetails>
                </Accordion>
              </>
            )
          )}
        </Box>
      </Drawer>

      {/* Main area */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar */}
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar variant="dense">
            <IconButton
              edge="start"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ mr: 1 }}
            >
              {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>

            <Typography variant="subtitle1" sx={{ flexGrow: 1 }} noWrap>
              {currentReport?.title ?? "New Report"}
              {dirty && (
                <Typography
                  component="span"
                  variant="caption"
                  color="warning.main"
                  sx={{ ml: 1 }}
                >
                  (unsaved)
                </Typography>
              )}
            </Typography>

            {/* Favorite toggle */}
            {currentReport && availableActions.includes("favorite") && (
              <IconButton
                onClick={() => handleAction("favorite")}
                color={currentReport.isFavorited ? "warning" : "default"}
                size="small"
              >
                {currentReport.isFavorited ? (
                  <StarIcon fontSize="small" />
                ) : (
                  <StarBorderIcon fontSize="small" />
                )}
              </IconButton>
            )}

            {/* Save */}
            <Button
              startIcon={
                saving ? <CircularProgress size={16} /> : <SaveIcon />
              }
              onClick={handleSave}
              disabled={!state.datasetKey || saving || !dirty}
              size="small"
              sx={{ mr: 1 }}
            >
              Save
            </Button>

            {/* Export */}
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => handleExport("xlsx")}
              disabled={!state.datasetKey}
              size="small"
              sx={{ mr: 1 }}
            >
              Export
            </Button>

            {/* Actions menu */}
            {availableActions.length > 0 && (
              <>
                <IconButton
                  size="small"
                  onClick={(e) => setActionsAnchor(e.currentTarget)}
                >
                  <MoreVertIcon />
                </IconButton>
                <Menu
                  anchorEl={actionsAnchor}
                  open={Boolean(actionsAnchor)}
                  onClose={() => setActionsAnchor(null)}
                >
                  {availableActions
                    .filter((a) => a !== "favorite") // handled separately
                    .map((action) => (
                      <MenuItem
                        key={action}
                        onClick={() => handleAction(action)}
                      >
                        <ListItemIcon>
                          {ACTION_ICONS[action]}
                        </ListItemIcon>
                        <ListItemText>{ACTION_LABELS[action]}</ListItemText>
                      </MenuItem>
                    ))}
                  <Divider />
                  <MenuItem onClick={() => handleExport("csv")}>
                    <ListItemIcon>
                      <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Export CSV</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => handleExport("xlsx")}>
                    <ListItemIcon>
                      <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Export XLSX</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            )}
          </Toolbar>
        </AppBar>

        {/* Error banner */}
        {state.error && (
          <Alert
            severity="error"
            onClose={() => dispatch({ type: "SET_ERROR", error: null })}
            sx={{ borderRadius: 0 }}
          >
            {state.error}
          </Alert>
        )}

        {/* Grid */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {state.datasetKey ? (
            <DataGrid
              datasetKey={state.datasetKey}
              columns={state.columns}
              selectedColumns={state.selectedColumns}
              filterGroup={state.filterGroup}
              rowGroupCols={state.rowGroupCols}
              pivotCols={state.pivotCols}
              valueCols={state.valueCols}
              sortModel={state.sortModel}
              activeTab={state.activeTab}
              pivotCapable={pivotCapable}
              onActiveTabChange={setActiveTab}
              onSortModelChange={setSortModel}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography variant="h6" color="text.secondary">
                Select a dataset to get started
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snackbar ? (
          <Alert
            onClose={() => setSnackbar(null)}
            severity={snackbar.severity}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

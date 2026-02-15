/**
 * PivotConfigurator — drag-and-drop zone configurator for AG Grid SSRM
 * row groups, pivot columns, and value/measure columns.
 *
 * Uses HTML5 native drag-and-drop (no external DnD library). Columns are
 * dragged from an "Available" pool into Row Groups, Pivot Columns, or
 * Values zones. Value columns get an aggFunc selector.
 */

import { useCallback, useMemo, useState, type DragEvent } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import type { AggFunc, Column, ColumnVO } from "../api/types";

// ─── Props ───────────────────────────────────────────────────────────

export interface PivotConfiguratorProps {
  columns: Column[];
  rowGroupCols: ColumnVO[];
  pivotCols: ColumnVO[];
  valueCols: ColumnVO[];
  onRowGroupColsChange: (cols: ColumnVO[]) => void;
  onPivotColsChange: (cols: ColumnVO[]) => void;
  onValueColsChange: (cols: ColumnVO[]) => void;
  /** Hide pivot zone (table-only mode) */
  hidePivotZone?: boolean;
  disabled?: boolean;
}

type ZoneId = "rowGroup" | "pivot" | "value";

const DEFAULT_AGG: AggFunc = "sum";

// ─── Helpers ─────────────────────────────────────────────────────────

function columnToVO(col: Column, aggFunc?: AggFunc): ColumnVO {
  return {
    id: col.name,
    displayName: col.label,
    field: col.name,
    ...(aggFunc ? { aggFunc } : {}),
  };
}

function isInZone(name: string, ...zones: ColumnVO[][]): boolean {
  return zones.some((z) => z.some((c) => c.id === name));
}

// ─── Component ───────────────────────────────────────────────────────

export function PivotConfigurator({
  columns,
  rowGroupCols,
  pivotCols,
  valueCols,
  onRowGroupColsChange,
  onPivotColsChange,
  onValueColsChange,
  hidePivotZone = false,
  disabled = false,
}: PivotConfiguratorProps) {
  const [dragOverZone, setDragOverZone] = useState<ZoneId | null>(null);

  // Available columns = those not already placed in any zone
  const availableColumns = useMemo(
    () =>
      columns.filter(
        (c) => !isInZone(c.name, rowGroupCols, pivotCols, valueCols),
      ),
    [columns, rowGroupCols, pivotCols, valueCols],
  );

  // ── Drag handlers ────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: DragEvent, columnName: string, sourceZone?: ZoneId) => {
      e.dataTransfer.setData("text/plain", columnName);
      e.dataTransfer.setData(
        "application/x-sanjaya-source",
        sourceZone ?? "available",
      );
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: DragEvent, zone: ZoneId) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverZone !== zone) setDragOverZone(zone);
    },
    [dragOverZone],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverZone(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent, targetZone: ZoneId) => {
      e.preventDefault();
      setDragOverZone(null);
      const columnName = e.dataTransfer.getData("text/plain");
      const sourceZone = e.dataTransfer.getData(
        "application/x-sanjaya-source",
      ) as ZoneId | "available";

      if (!columnName) return;

      const col = columns.find((c) => c.name === columnName);
      if (!col) return;

      // Remove from source zone if moving between zones
      if (sourceZone === "rowGroup") {
        onRowGroupColsChange(rowGroupCols.filter((c) => c.id !== columnName));
      } else if (sourceZone === "pivot") {
        onPivotColsChange(pivotCols.filter((c) => c.id !== columnName));
      } else if (sourceZone === "value") {
        onValueColsChange(valueCols.filter((c) => c.id !== columnName));
      }

      // Add to target zone (avoid duplicates)
      if (targetZone === "rowGroup" && !rowGroupCols.some((c) => c.id === columnName)) {
        onRowGroupColsChange([...rowGroupCols, columnToVO(col)]);
      } else if (targetZone === "pivot" && !pivotCols.some((c) => c.id === columnName)) {
        onPivotColsChange([...pivotCols, columnToVO(col)]);
      } else if (targetZone === "value" && !valueCols.some((c) => c.id === columnName)) {
        const defaultAgg =
          col.pivot?.allowedAggs?.[0]?.agg ?? DEFAULT_AGG;
        onValueColsChange([
          ...valueCols,
          columnToVO(col, defaultAgg),
        ]);
      }
    },
    [
      columns,
      rowGroupCols,
      pivotCols,
      valueCols,
      onRowGroupColsChange,
      onPivotColsChange,
      onValueColsChange,
    ],
  );

  const handleRemoveFromZone = useCallback(
    (columnName: string, zone: ZoneId) => {
      if (zone === "rowGroup") {
        onRowGroupColsChange(rowGroupCols.filter((c) => c.id !== columnName));
      } else if (zone === "pivot") {
        onPivotColsChange(pivotCols.filter((c) => c.id !== columnName));
      } else if (zone === "value") {
        onValueColsChange(valueCols.filter((c) => c.id !== columnName));
      }
    },
    [rowGroupCols, pivotCols, valueCols, onRowGroupColsChange, onPivotColsChange, onValueColsChange],
  );

  const handleAggFuncChange = useCallback(
    (columnName: string, aggFunc: AggFunc) => {
      onValueColsChange(
        valueCols.map((c) =>
          c.id === columnName ? { ...c, aggFunc } : c,
        ),
      );
    },
    [valueCols, onValueColsChange],
  );

  if (columns.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        Select a dataset to configure grouping.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Available columns */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Available Columns
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            p: 1,
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
            minHeight: 40,
          }}
        >
          {availableColumns.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              All columns assigned
            </Typography>
          ) : (
            availableColumns.map((col) => (
              <Chip
                key={col.name}
                label={col.label}
                size="small"
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e as unknown as DragEvent, col.name)}
                sx={{ cursor: disabled ? "default" : "grab" }}
              />
            ))
          )}
        </Paper>
      </Box>

      {/* Drop zones */}
      <DropZone
        label="Row Groups"
        zoneId="rowGroup"
        items={rowGroupCols}
        columns={columns}
        dragOverZone={dragOverZone}
        disabled={disabled}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onRemove={handleRemoveFromZone}
      />

      {!hidePivotZone && (
        <DropZone
          label="Pivot Columns"
          zoneId="pivot"
          items={pivotCols}
          columns={columns}
          dragOverZone={dragOverZone}
          disabled={disabled}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onRemove={handleRemoveFromZone}
        />
      )}

      <DropZone
        label="Values"
        zoneId="value"
        items={valueCols}
        columns={columns}
        dragOverZone={dragOverZone}
        disabled={disabled}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onRemove={handleRemoveFromZone}
        showAggFunc
        onAggFuncChange={handleAggFuncChange}
      />
    </Box>
  );
}

// ─── Drop zone sub-component ─────────────────────────────────────────

interface DropZoneProps {
  label: string;
  zoneId: ZoneId;
  items: ColumnVO[];
  columns: Column[];
  dragOverZone: ZoneId | null;
  disabled: boolean;
  onDragStart: (e: DragEvent, columnName: string, sourceZone: ZoneId) => void;
  onDragOver: (e: DragEvent, zone: ZoneId) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, zone: ZoneId) => void;
  onRemove: (columnName: string, zone: ZoneId) => void;
  showAggFunc?: boolean;
  onAggFuncChange?: (columnName: string, aggFunc: AggFunc) => void;
}

function DropZone({
  label,
  zoneId,
  items,
  columns,
  dragOverZone,
  disabled,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  showAggFunc,
  onAggFuncChange,
}: DropZoneProps) {
  const isOver = dragOverZone === zoneId;

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>
      <Paper
        variant="outlined"
        onDragOver={(e) => onDragOver(e as unknown as DragEvent, zoneId)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e as unknown as DragEvent, zoneId)}
        sx={{
          p: 1,
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          minHeight: 40,
          bgcolor: isOver ? "action.hover" : "transparent",
          borderColor: isOver ? "primary.main" : undefined,
          borderStyle: isOver ? "dashed" : "solid",
          transition: "all 0.15s",
        }}
      >
        {items.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Drag columns here
          </Typography>
        ) : (
          items.map((item) => {
            const colMeta = columns.find((c) => c.name === item.id);
            const allowedAggs = colMeta?.pivot?.allowedAggs;

            return (
              <Box
                key={item.id}
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <Chip
                  label={item.displayName}
                  size="small"
                  onDelete={disabled ? undefined : () => onRemove(item.id, zoneId)}
                  draggable={!disabled}
                  onDragStart={(e) =>
                    onDragStart(e as unknown as DragEvent, item.id, zoneId)
                  }
                  sx={{ cursor: disabled ? "default" : "grab" }}
                />
                {showAggFunc && item.aggFunc && onAggFuncChange && (
                  <Select
                    value={item.aggFunc}
                    onChange={(e) =>
                      onAggFuncChange(item.id, e.target.value as AggFunc)
                    }
                    size="small"
                    disabled={disabled}
                    variant="standard"
                    sx={{ minWidth: 70, fontSize: "0.75rem" }}
                  >
                    {(allowedAggs ?? DEFAULT_AGG_OPTIONS).map((opt) => (
                      <MenuItem
                        key={typeof opt === "string" ? opt : opt.agg}
                        value={typeof opt === "string" ? opt : opt.agg}
                      >
                        {typeof opt === "string" ? opt : opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              </Box>
            );
          })
        )}
      </Paper>
    </Box>
  );
}

const DEFAULT_AGG_OPTIONS: { agg: AggFunc; label: string }[] = [
  { agg: "sum", label: "Sum" },
  { agg: "avg", label: "Average" },
  { agg: "min", label: "Min" },
  { agg: "max", label: "Max" },
  { agg: "count", label: "Count" },
  { agg: "distinctCount", label: "Distinct" },
  { agg: "first", label: "First" },
  { agg: "last", label: "Last" },
];

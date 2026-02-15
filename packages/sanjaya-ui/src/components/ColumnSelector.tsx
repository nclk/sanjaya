/**
 * ColumnSelector — checkbox list for selecting visible columns.
 *
 * Reads column metadata and lets users toggle which columns are included
 * in the grid display and export. Columns are grouped by type.
 */

import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import type { Column, ColumnType } from "../api/types";

export interface ColumnSelectorProps {
  /** Full column metadata from the dataset */
  columns: Column[];
  /** Currently selected column names */
  selectedColumns: string[];
  /** Called when selection changes */
  onChange: (selectedColumns: string[]) => void;
  /** Disable all controls */
  disabled?: boolean;
}

const TYPE_LABELS: Record<ColumnType, string> = {
  string: "Text",
  number: "Number",
  currency: "Currency",
  percentage: "Percentage",
  date: "Date",
  datetime: "Date/Time",
  boolean: "Boolean",
};

export function ColumnSelector({
  columns,
  selectedColumns,
  onChange,
  disabled = false,
}: ColumnSelectorProps) {
  const selectedSet = useMemo(
    () => new Set(selectedColumns),
    [selectedColumns],
  );

  const grouped = useMemo(() => {
    const groups = new Map<ColumnType, Column[]>();
    for (const col of columns) {
      const list = groups.get(col.type) ?? [];
      list.push(col);
      groups.set(col.type, list);
    }
    return groups;
  }, [columns]);

  const handleToggle = useCallback(
    (columnName: string) => {
      const next = selectedSet.has(columnName)
        ? selectedColumns.filter((c) => c !== columnName)
        : [...selectedColumns, columnName];
      onChange(next);
    },
    [selectedColumns, selectedSet, onChange],
  );

  const handleSelectAll = useCallback(() => {
    onChange(columns.map((c) => c.name));
  }, [columns, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  if (columns.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        Select a dataset to see available columns.
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
        <Button size="small" onClick={handleSelectAll} disabled={disabled}>
          Select All
        </Button>
        <Button size="small" onClick={handleClearAll} disabled={disabled}>
          Clear
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto", alignSelf: "center" }}
        >
          {selectedColumns.length} / {columns.length}
        </Typography>
      </Box>

      {Array.from(grouped.entries()).map(([type, cols]) => (
        <Box key={type} sx={{ mb: 1 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ px: 1 }}
          >
            {TYPE_LABELS[type] ?? type}
          </Typography>
          <Divider />
          <FormGroup sx={{ pl: 1 }}>
            {cols.map((col) => (
              <FormControlLabel
                key={col.name}
                control={
                  <Checkbox
                    checked={selectedSet.has(col.name)}
                    onChange={() => handleToggle(col.name)}
                    size="small"
                    disabled={disabled}
                  />
                }
                label={
                  <Typography variant="body2">{col.label}</Typography>
                }
              />
            ))}
          </FormGroup>
        </Box>
      ))}
    </Box>
  );
}

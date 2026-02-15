/**
 * FilterBuilder — recursive component for building FilterGroup trees.
 *
 * Renders nested groups with combinator selectors, and individual
 * conditions with column / operator / value controls. Uses column
 * metadata to drive operator lists, filterStyle hints, and enumValues.
 */

import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import type {
  Column,
  FilterCombinator,
  FilterCondition,
  FilterGroup,
  FilterOperator,
} from "../api/types";

// ─── Operator labels ─────────────────────────────────────────────────

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "equals",
  neq: "not equals",
  gt: "greater than",
  lt: "less than",
  gte: "≥",
  lte: "≤",
  contains: "contains",
  startswith: "starts with",
  endswith: "ends with",
  isNull: "is empty",
  isNotNull: "is not empty",
  between: "between",
  in: "is one of",
};

/** Operators that don't require a value input */
const VALUELESS_OPERATORS = new Set<FilterOperator>(["isNull", "isNotNull"]);

// ─── Props ───────────────────────────────────────────────────────────

export interface FilterBuilderProps {
  /** Column metadata — drives operator lists, enum values, etc. */
  columns: Column[];
  /** Current filter group */
  filterGroup: FilterGroup;
  /** Called on every change */
  onChange: (filterGroup: FilterGroup) => void;
  /** Disable all controls */
  disabled?: boolean;
}

// ─── Root component ──────────────────────────────────────────────────

export function FilterBuilder({
  columns,
  filterGroup,
  onChange,
  disabled = false,
}: FilterBuilderProps) {
  if (columns.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        Select a dataset to build filters.
      </Typography>
    );
  }

  return (
    <FilterGroupEditor
      columns={columns}
      group={filterGroup}
      onChange={onChange}
      disabled={disabled}
      depth={0}
    />
  );
}

// ─── Group editor ────────────────────────────────────────────────────

interface FilterGroupEditorProps {
  columns: Column[];
  group: FilterGroup;
  onChange: (group: FilterGroup) => void;
  onRemove?: () => void;
  disabled: boolean;
  depth: number;
}

function FilterGroupEditor({
  columns,
  group,
  onChange,
  onRemove,
  disabled,
  depth,
}: FilterGroupEditorProps) {
  const handleCombinatorChange = useCallback(
    (combinator: FilterCombinator) => {
      onChange({ ...group, combinator });
    },
    [group, onChange],
  );

  const handleAddCondition = useCallback(() => {
    const firstCol = columns[0];
    const newCondition: FilterCondition = {
      column: firstCol?.name ?? "",
      operator: firstCol?.operators[0] ?? "eq",
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  }, [columns, group, onChange]);

  const handleAddGroup = useCallback(() => {
    const newGroup: FilterGroup = {
      combinator: "and",
      conditions: [],
    };
    onChange({
      ...group,
      groups: [...(group.groups ?? []), newGroup],
    });
  }, [group, onChange]);

  const handleConditionChange = useCallback(
    (index: number, condition: FilterCondition) => {
      const next = [...group.conditions];
      next[index] = condition;
      onChange({ ...group, conditions: next });
    },
    [group, onChange],
  );

  const handleConditionRemove = useCallback(
    (index: number) => {
      onChange({
        ...group,
        conditions: group.conditions.filter((_, i) => i !== index),
      });
    },
    [group, onChange],
  );

  const handleGroupChange = useCallback(
    (index: number, subGroup: FilterGroup) => {
      const next = [...(group.groups ?? [])];
      next[index] = subGroup;
      onChange({ ...group, groups: next });
    },
    [group, onChange],
  );

  const handleGroupRemove = useCallback(
    (index: number) => {
      onChange({
        ...group,
        groups: (group.groups ?? []).filter((_, i) => i !== index),
      });
    },
    [group, onChange],
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        ml: depth > 0 ? 2 : 0,
        borderLeft: depth > 0 ? 3 : 0,
        borderColor: depth % 2 === 0 ? "primary.main" : "secondary.main",
      }}
    >
      {/* Group header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Select
          value={group.combinator}
          onChange={(e) =>
            handleCombinatorChange(e.target.value as FilterCombinator)
          }
          size="small"
          disabled={disabled}
          sx={{ minWidth: 80 }}
        >
          <MenuItem value="and">AND</MenuItem>
          <MenuItem value="or">OR</MenuItem>
        </Select>

        {group.not && (
          <Chip label="NOT" size="small" color="warning" variant="outlined" />
        )}

        <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
          <Tooltip title="Add condition">
            <IconButton
              size="small"
              onClick={handleAddCondition}
              disabled={disabled}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add group">
            <IconButton
              size="small"
              onClick={handleAddGroup}
              disabled={disabled}
            >
              <PlaylistAddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {onRemove && (
            <Tooltip title="Remove group">
              <IconButton
                size="small"
                onClick={onRemove}
                disabled={disabled}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Conditions */}
      {group.conditions.map((cond, i) => (
        <FilterConditionEditor
          key={i}
          columns={columns}
          condition={cond}
          onChange={(c) => handleConditionChange(i, c)}
          onRemove={() => handleConditionRemove(i)}
          disabled={disabled}
        />
      ))}

      {/* Nested groups */}
      {(group.groups ?? []).map((sub, i) => (
        <FilterGroupEditor
          key={`g-${i}`}
          columns={columns}
          group={sub}
          onChange={(g) => handleGroupChange(i, g)}
          onRemove={() => handleGroupRemove(i)}
          disabled={disabled}
          depth={depth + 1}
        />
      ))}

      {/* Empty state */}
      {group.conditions.length === 0 && (group.groups ?? []).length === 0 && (
        <Box sx={{ textAlign: "center", py: 2 }}>
          <Button
            variant="text"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddCondition}
            disabled={disabled}
          >
            Add a filter condition
          </Button>
        </Box>
      )}
    </Paper>
  );
}

// ─── Condition editor ────────────────────────────────────────────────

interface FilterConditionEditorProps {
  columns: Column[];
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
  disabled: boolean;
}

function FilterConditionEditor({
  columns,
  condition,
  onChange,
  onRemove,
  disabled,
}: FilterConditionEditorProps) {
  const columnMeta = useMemo(
    () => columns.find((c) => c.name === condition.column),
    [columns, condition.column],
  );

  const operators = columnMeta?.operators ?? ["eq"];
  const isValueless = VALUELESS_OPERATORS.has(condition.operator);
  const isSelect = columnMeta?.filterStyle === "select" && columnMeta.enumValues;
  const isBetween = condition.operator === "between";
  const isIn = condition.operator === "in";

  const handleColumnChange = useCallback(
    (columnName: string) => {
      const col = columns.find((c) => c.name === columnName);
      const newOp = col?.operators[0] ?? "eq";
      onChange({ column: columnName, operator: newOp });
    },
    [columns, onChange],
  );

  const handleOperatorChange = useCallback(
    (op: FilterOperator) => {
      const next: FilterCondition = { ...condition, operator: op };
      if (VALUELESS_OPERATORS.has(op)) {
        delete next.value;
      }
      onChange(next);
    },
    [condition, onChange],
  );

  const handleValueChange = useCallback(
    (value: unknown) => {
      onChange({ ...condition, value });
    },
    [condition, onChange],
  );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mb: 0.5,
        flexWrap: "wrap",
      }}
    >
      {/* Column */}
      <Select
        value={condition.column}
        onChange={(e) => handleColumnChange(e.target.value)}
        size="small"
        disabled={disabled}
        sx={{ minWidth: 140 }}
      >
        {columns.map((col) => (
          <MenuItem key={col.name} value={col.name}>
            {col.label}
          </MenuItem>
        ))}
      </Select>

      {/* Operator */}
      <Select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
        size="small"
        disabled={disabled}
        sx={{ minWidth: 120 }}
      >
        {operators.map((op) => (
          <MenuItem key={op} value={op}>
            {OPERATOR_LABELS[op] ?? op}
          </MenuItem>
        ))}
      </Select>

      {/* Value input */}
      {!isValueless && (
        <>
          {isSelect && columnMeta?.enumValues ? (
            <Autocomplete
              value={condition.value as string ?? ""}
              onChange={(_, v) => handleValueChange(v)}
              options={columnMeta.enumValues}
              size="small"
              disabled={disabled}
              sx={{ minWidth: 160 }}
              renderInput={(params) => (
                <TextField {...params} placeholder="Value" size="small" />
              )}
            />
          ) : isIn ? (
            <Autocomplete
              multiple
              freeSolo
              value={(condition.value as string[]) ?? []}
              onChange={(_, v) => handleValueChange(v)}
              options={columnMeta?.enumValues ?? []}
              size="small"
              disabled={disabled}
              sx={{ minWidth: 200 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Values (press Enter)"
                  size="small"
                />
              )}
            />
          ) : isBetween ? (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              <TextField
                value={(condition.value as [unknown, unknown])?.[0] ?? ""}
                onChange={(e) =>
                  handleValueChange([
                    e.target.value,
                    (condition.value as [unknown, unknown])?.[1] ?? "",
                  ])
                }
                size="small"
                placeholder="From"
                disabled={disabled}
                sx={{ width: 100 }}
              />
              <Typography variant="body2">–</Typography>
              <TextField
                value={(condition.value as [unknown, unknown])?.[1] ?? ""}
                onChange={(e) =>
                  handleValueChange([
                    (condition.value as [unknown, unknown])?.[0] ?? "",
                    e.target.value,
                  ])
                }
                size="small"
                placeholder="To"
                disabled={disabled}
                sx={{ width: 100 }}
              />
            </Box>
          ) : (
            <TextField
              value={(condition.value as string) ?? ""}
              onChange={(e) => handleValueChange(e.target.value)}
              size="small"
              placeholder="Value"
              disabled={disabled}
              sx={{ minWidth: 120 }}
            />
          )}
        </>
      )}

      {/* Remove */}
      <Tooltip title="Remove condition">
        <IconButton
          size="small"
          onClick={onRemove}
          disabled={disabled}
          color="error"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

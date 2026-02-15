/**
 * DatasetPicker — MUI Autocomplete for selecting a reporting dataset.
 *
 * Fetches available datasets on mount via `useSanjayaClient().listDatasets()`
 * and renders a searchable dropdown.
 */

import { useCallback, useEffect, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useSanjayaClient } from "../providers/SanjayaProvider";
import type { Dataset } from "../api/types";

export interface DatasetPickerProps {
  /** Currently selected dataset key */
  value: string | null;
  /** Called when the user picks a dataset */
  onChange: (datasetKey: string | null) => void;
  /** Pre-loaded datasets (skip fetch if provided) */
  datasets?: Dataset[];
  /** Disable the picker */
  disabled?: boolean;
}

export function DatasetPicker({
  value,
  onChange,
  datasets: externalDatasets,
  disabled = false,
}: DatasetPickerProps) {
  const client = useSanjayaClient();
  const [datasets, setDatasets] = useState<Dataset[]>(externalDatasets ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (externalDatasets) {
      setDatasets(externalDatasets);
      return;
    }
    let cancelled = false;
    setLoading(true);
    client
      .listDatasets()
      .then((res) => {
        if (!cancelled) setDatasets(res.datasets);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, externalDatasets]);

  const selectedDataset = datasets.find((d) => d.key === value) ?? null;

  const handleChange = useCallback(
    (_: unknown, ds: Dataset | null) => {
      onChange(ds?.key ?? null);
    },
    [onChange],
  );

  if (error) {
    return (
      <Typography color="error" variant="body2">
        Failed to load datasets: {error}
      </Typography>
    );
  }

  return (
    <Autocomplete
      value={selectedDataset}
      onChange={handleChange}
      options={datasets}
      getOptionLabel={(d) => d.label}
      isOptionEqualToValue={(a, b) => a.key === b.key}
      loading={loading}
      disabled={disabled}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.key}>
          <Box>
            <Typography variant="body1">{option.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {option.description}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Dataset"
          placeholder="Search datasets…"
          size="small"
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Dataset types — mirror sanjaya_django.schemas.datasets
// ---------------------------------------------------------------------------

/**
 * Capability flags advertised by a dataset.
 */
export interface DatasetCapabilities {
  pivot: boolean;
}

/**
 * Summary of a registered dataset.
 *
 * Returned by `SanjayaDataClient.listDatasets()`.
 */
export interface DatasetSummary {
  key: string;
  label: string;
  description: string;
  capabilities: DatasetCapabilities;
}

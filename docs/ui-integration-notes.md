# UI Integration Notes — AG Grid SSRM

These notes capture design decisions relevant to the front-end team's
integration with the Sanjaya SSRM endpoints. They reflect agreements made
during the backend implementation (Feb 2026) and are intended to guide the
UI rewrite.

---

## 1. Endpoint overview

| Endpoint | Purpose | Tab |
|----------|---------|-----|
| `GET /datasets/{key}/columns` | Rich column metadata (operators, enumValues, pivot hints, formatHints) | Both |
| `POST /datasets/{key}/table` | Flat data, row grouping, aggregation (SSRM, no pivot) | Table |
| `POST /datasets/{key}/pivot` | Pivot queries (SSRM, requires ≥1 pivot column) | Pivot |
| `POST /datasets/{key}/export` | CSV / XLSX export (flat, grouped, or pivot) | Both |

---

## 2. Custom widgets + AG Grid SSRM datasource

The UI does **not** use AG Grid's built-in column menu, filter panel, or
pivot drop zones. Instead:

- **Column picker** — a custom widget that reads `/columns` metadata and
  lets the user select visible columns, row-group columns, pivot columns,
  and value/measure columns with aggregate functions.
- **Filter builder** — a custom widget that uses the operator list and
  `filterStyle` hints from `/columns` to build rich, nested filter trees.
- **AG Grid** — configured with a custom `IServerSideDatasource`. The
  datasource's `getRows(params)` callback takes the *structural* parts of
  the request from AG Grid (pagination, groupKeys, rowGroupCols, sort) and
  injects the *semantic* parts from the custom widgets (column selection,
  filters).

### Datasource sketch

```ts
const datasource: IServerSideDatasource = {
  getRows(params) {
    const body = {
      // Structural — managed by AG Grid as the user scrolls, sorts,
      // expands/collapses groups.
      startRow:      params.request.startRow,
      endRow:        params.request.endRow,
      rowGroupCols:  params.request.rowGroupCols,
      groupKeys:     params.request.groupKeys,
      valueCols:     params.request.valueCols,
      sortModel:     params.request.sortModel,

      // Semantic — injected from custom widgets, NOT from
      // params.request.filterModel.
      filter:        filterBuilderState.toFilterGroup(),
    };

    fetch(`/datasets/${datasetKey}/table`, {
      method: "POST",
      body: JSON.stringify(body),
    })
      .then(res => res.json())
      .then(data => params.success({
        rowData:  data.rowData,
        rowCount: data.rowCount,
      }))
      .catch(() => params.fail());
  },
};
```

---

## 3. Filter format on the wire

### Decision: explicit `filter` field (sanjaya-core `FilterGroup` format)

The SSRM request schemas accept **two** filter fields:

| Field | Format | Purpose |
|-------|--------|---------|
| `filter` | Sanjaya `FilterGroup` JSON — nested groups, full operator set | **Primary.** Used by custom filter builder widgets. |
| `filterModel` | AG Grid column-keyed filter model | **Legacy / fallback.** Available if the UI ever needs AG Grid's built-in filters for quick prototyping. |

The server checks `filter` first. If present, it is parsed directly as a
`FilterGroup`. If absent, `filterModel` is parsed using the AG Grid
translation layer (`parse_ag_grid_filter_model`). If both are absent, no
filtering is applied.

### Why not just `filterModel`?

AG Grid's filter model is column-keyed and flat — it doesn't natively
support nested groups, `between`, `in`, `isNull`, or negation. Converting
a rich `FilterGroup` to AG Grid's format and back is lossy. Sending the
rich format directly avoids a double translation and preserves the full
operator vocabulary exposed by `/columns`.

### `FilterGroup` shape reference

```json
{
  "combinator": "and",
  "conditions": [
    { "column": "region", "operator": "eq", "value": "EMEA" },
    { "column": "amount", "operator": "between", "value": [100, 500] }
  ],
  "groups": [
    {
      "combinator": "or",
      "not": true,
      "conditions": [
        { "column": "status", "operator": "in", "value": ["open", "pending"] }
      ]
    }
  ]
}
```

---

## 4. Column selection

Visible columns are **not** sent in the SSRM request body. The UI controls
which AG Grid column definitions are active via the grid's imperative API
(`api.setColumnDefs()` or `api.applyColumnState()`). The server returns all
relevant fields for the group level being fetched; the grid displays only
those the user has selected.

For **export**, the flat variant includes `selectedColumns` explicitly so
the server knows which columns to include in the file.

---

## 5. Row grouping vs. pivot — UI tab mapping

| UI state | Endpoint | `rowGroupCols` | `valueCols` | Pivot fields |
|----------|----------|---------------|-------------|-------------|
| Table — flat | `/table` | `[]` | `[]` | n/a |
| Table — grouped | `/table` | `[Region, Desk]` | `[{id: "amount", aggFunc: "sum"}]` | n/a |
| Table — drill-down | `/table` | `[Region, Desk]` | `[…]` | n/a |
| Pivot | `/pivot` | `[Region]` | `[{id: "amount", aggFunc: "sum"}]` | `pivotCols: [Counterparty]`, `pivotMode: true` |

### Grouped rows: expandable vs. flat summary

Whether grouped rows show chevrons (drill-down) or render as a flat
summary table is a **front-end AG Grid config** decision:

```ts
// Flat summary — no drill-down
gridOptions.isServerSideGroup = () => false;

// Expandable tree — default
gridOptions.isServerSideGroup = (row) => row.group !== undefined;
```

The server response is identical in both cases. Only the grid's behaviour
changes.

---

## 6. Export

Export requests match the UI tab the user is on:

| Tab state | Export variant | What gets exported |
|-----------|---------------|-------------------|
| Table — no groups | `flat` | All rows matching filters |
| Table — grouped | `grouped` | Top-level aggregated summary (no drill-down) |
| Pivot | `pivot` | Cross-tab spreadsheet |

The server materialises the full result (ignoring pagination) and streams
CSV or XLSX.

---

## 7. Pivot result columns

When the pivot endpoint returns data, it includes `pivotResultFields` —
a list of dynamically generated field names (e.g.,
`["Widget_sum_amount", "Gadget_sum_amount"]`). AG Grid uses the
`serverSidePivotResultFieldSeparator` (default `_`) to parse these into
column group headers.

For advanced header control, the server can optionally return
`secondaryColDefs` instead — a tree of `PivotResultColDef` objects that
the UI applies via `api.setPivotResultColumns()`.

---

## 8. Refresh triggers

The UI should call `api.refreshServerSide({ purge: true })` whenever:

- The filter builder state changes
- The user changes column selection (if it affects row-group or value cols)
- The user switches between table and pivot tabs (different endpoint + grid config)

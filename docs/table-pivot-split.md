# Table / Pivot Endpoint Split

## Goal

Split the current combined `/datasets/{key}/pivot` SSRM endpoint into two
dedicated endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /datasets/{key}/table` | Flat data + row grouping + aggregation (no pivot) |
| `POST /datasets/{key}/pivot` | Pivot only — requires `pivotMode: true` and ≥1 pivot column |

Both endpoints serve AG Grid's Server-Side Row Model (SSRM) but enforce a
clear separation matching the UI's "Table" and "Pivot" tabs.

---

## Phase 1 — TypeSpec & OpenAPI (API-first)

**Files touched:**
- `api/models/dynamic-reports.tsp`
- `api/rest/api/dynamic-reporting.tsp`

**Work:**

1. Factor the existing `ServerSideGetRowsRequest` model into a shared base
   (`SSRMBaseRequest`) and a pivot-specific subclass that adds `pivotCols`
   and `pivotMode`.

2. Add `TableGetRowsRequest` model to `dynamic-reports.tsp` — extends the
   shared base, no `pivotCols`/`pivotMode`.

3. Add `POST /datasets/{key}/table` operation to `dynamic-reporting.tsp`.

4. Document the 400 response on the pivot endpoint for missing pivot columns.

5. Regenerate: `cd api && pnpm build`.

---

## Phase 2 — Shared schema base & table request schema

**Files touched:**
- `packages/sanjaya-django/src/sanjaya_django/schemas/ssrm.py` (new)
- `packages/sanjaya-django/src/sanjaya_django/schemas/pivot.py` (slim down)

**Work:**

1. Create `schemas/ssrm.py` with a shared base class containing the fields
   common to both endpoints:
   - `start_row`, `end_row`
   - `row_group_cols`, `group_keys`
   - `value_cols`
   - `sort_model`, `filter_model`

2. Define `TableGetRowsRequest` in the same file — extends the base, adds
   nothing pivot-specific.

3. Move `ColumnVO`, `SortModelItem`, `ServerSideGetRowsResponse`, and
   `PivotResultColDef` into `schemas/ssrm.py` (they're shared).

4. Update `schemas/pivot.py` to import the base from `ssrm.py` and define
   `ServerSideGetRowsRequest` as a subclass that adds `pivot_cols` and
   `pivot_mode`.

5. Fix any imports across the codebase that referenced the moved symbols.

---

## Phase 3 — Service layer: rename & add table handler

**Files touched:**
- `packages/sanjaya-django/src/sanjaya_django/services/pivot.py` → rename to `services/ssrm.py`
- `packages/sanjaya-django/src/sanjaya_django/services/export.py` (update import)
- `packages/sanjaya-django/src/sanjaya_django/schemas/export.py` (add grouped variant)

**Work:**

1. Rename `services/pivot.py` → `services/ssrm.py`.

2. Add `handle_table_ssrm_request()` — reuses filter translation, group-key
   injection, depth-based row grouping, sort, and pagination, but:
   - Never passes `group_by_cols` to the provider.
   - At leaf level → `provider.query()`.
   - At non-leaf level → `provider.aggregate()` with `group_by_cols=[]`.

3. Keep `handle_ssrm_request()` (the pivot handler) in the same file but
   remove its leaf-level `provider.query()` fallback — that path now belongs
   to the table handler.

4. Update `services/export.py` to import from `services.ssrm`.

5. Add grouped export support:
   - Add `GroupedExportSchema` to `schemas/export.py` — same shape as
     `PivotExportSchema` minus `pivot_cols`.
   - Update `ExportRequestSchema` to accept `flat | grouped | pivot`
     (exactly one required).
   - In `services/export.py`, add a `grouped` branch that calls
     `provider.aggregate(group_by_cols=[])` with no limit, then renders
     the flat result as CSV/XLSX (no cross-tab reshaping needed).

---

## Phase 4 — Table endpoint & strict pivot validation

**Files touched:**
- `packages/sanjaya-django/src/sanjaya_django/api/table.py` (new)
- `packages/sanjaya-django/src/sanjaya_django/api/pivot.py` (add 400 guard)
- `packages/sanjaya-django/src/sanjaya_django/api/__init__.py` (register router)

**Work:**

1. Create `api/table.py` with `POST /{dataset_key}/table`:
   - Accepts `TableGetRowsRequest`.
   - Auth check (same pattern as pivot).
   - Calls `handle_table_ssrm_request()`.
   - No pivot capability check needed (row grouping + agg is standard).

2. In `api/pivot.py`, add a 400 guard at the top of the handler:
   ```python
   if not body.pivot_mode or not body.pivot_cols:
       return 400, CustomErrorResponse(
           details=[ErrorDetail(
               error_type="validation",
               message=(
                   "The /pivot endpoint requires pivotMode: true and at least "
                   "one pivot column. Use the /table endpoint for non-pivot queries."
               ),
           )]
       )
   ```

3. Update `api/pivot.py` to import `handle_ssrm_request` from
   `services.ssrm` (renamed).

4. Register the table router in `api/__init__.py`:
   ```python
   router.add_router("/datasets", table_router)
   ```

---

## Phase 5 — Tests

**Files touched:**
- `packages/sanjaya-django/tests/test_table_api.py` (new)
- `packages/sanjaya-django/tests/test_pivot_api.py` (update)

**Work:**

1. `test_table_api.py` — cover:
   - Flat data, no groups (leaf-level `query()`).
   - Row grouping: first-level groups returned.
   - Row grouping drill-down: `groupKeys` expand a level.
   - Row grouping + `valueCols` with `aggFunc` (aggregated group rows).
   - Sorting and filtering in table mode.
   - Auth required (401).
   - Dataset not found (404).

2. `test_pivot_api.py` — add:
   - **400 when `pivotMode` is `False`.**
   - **400 when `pivotCols` is empty.**
   - Existing pivot-with-data tests still pass.

---

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schema reuse | Shared base class in `schemas/ssrm.py` | Avoids duplicating 80% of fields |
| Service file | Single `services/ssrm.py` with two entry points | Both handlers share filter/sort/pagination logic |
| `valueCols` in table mode | Accepted (for row-group aggregation) | AG Grid sends these for group-row summaries even without pivot |
| Leaf-level fallback in pivot | Removed (400 instead) | Leaf-level flat queries belong to the table endpoint |
| Capability check for table | Not required | Row grouping + agg is a baseline; pivot is the optional capability |
| Grouped export | Third variant alongside flat & pivot | Exports the top-level summary only — no drill-down, no cross-tab reshaping, uniform row shape |

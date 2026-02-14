# Backend Addenda — Gaps Required by the UI MVP

> Items the UI team needs from the backend / API team to fully deliver the
> report builder web components described in
> [`ui-mvp-plan.md`](ui-mvp-plan.md).

---

## 1. Persist pivot configuration in `DynamicReportDefinition`

### Problem

The current `DynamicReportDefinition` (TypeSpec + backend) stores only three
fields:

```typescript
model DynamicReportDefinition {
  datasetKey: string;
  selectedColumns: string[];
  filter: FilterGroup;
}
```

Pivot layout — which columns are assigned to the Rows, Columns, and Values
zones, and what aggregate function is selected per value — is **not
persisted**. When a user saves a report that includes pivot configuration
and later reloads it, the pivot layout is lost.

### Requested change

Extend `DynamicReportDefinition` to include the pivot / table structural
config:

```typescript
model DynamicReportDefinition {
  datasetKey: string;
  selectedColumns: string[];
  filter: FilterGroup;

  /** Row-group columns (used in both table grouped mode and pivot) */
  rowGroupCols?: ColumnVO[];

  /** Pivot cross-tab columns (pivot mode only) */
  pivotCols?: ColumnVO[];

  /** Value/measure columns with aggregate functions */
  valueCols?: ColumnVO[];

  /** Sort model to restore column sort state */
  sortModel?: SortModelItem[];
}
```

All new fields are optional — a report with none of them set is a flat
table report (backward compatible).

### Scope of work

| Layer | File(s) | Change |
|-------|---------|--------|
| TypeSpec | `api/models/dynamic-reports.tsp` | Add optional fields to `DynamicReportDefinition` |
| OpenAPI | `api/tsp-output/…/openapi.yaml` | Regenerate (`pnpm build`) |
| Django schemas | `schemas/reports.py` | Accept + return the new fields inside `metadata.definition` |
| Django API | `api/reports.py` | No change — `metadata` is already an opaque `JSONField`; the structure contract lives in the TypeSpec |
| Tests | `tests/test_reports_api.py` | Add round-trip test: save a report with pivot config → reload → verify config intact |

### Notes

- Because `metadata` is already a `JSONField`, the Django model migration
  is **not** required — the new fields just appear inside the JSON blob.
- The UI will write the full `definition` object on save and expect to read
  it back verbatim on load. The backend should pass it through without
  stripping unknown keys.

---

## 2. Implement the `favorite` action

### Problem

`DynamicReportAction.favorite` exists in the TypeSpec enum:

```typescript
enum DynamicReportAction {
  edit,
  publish,
  unpublish,
  archive,
  restore,
  share,
  favorite,       // ← defined but not implemented
  transferOwnership,
  delete,
}
```

However, the backend has no implementation:

- `compute_available_actions()` in `services/reports.py` never appends
  `"favorite"` to the list.
- `perform_action()` has no `case "favorite"` branch.
- There is no storage for the favorite state (no model field, no separate
  table).

The UI report builder's Actions menu will include a **Favorite / Unfavorite**
toggle and expects the backend to support it.

### Requested change

Add a `DynamicReportFavorite` model (junction table):

```python
class DynamicReportFavorite(models.Model):
    report = models.ForeignKey(DynamicReport, on_delete=models.CASCADE, related_name="favorites")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("report", "user")
        default_permissions = ()
```

| Concern | Detail |
|---------|--------|
| `compute_available_actions()` | Always include `"favorite"` (any authenticated user with at least `viewer` access can favorite) |
| `perform_action("favorite")` | Toggle: if row exists → delete (unfavorite); if not → create (favorite) |
| Report response schema | Add `isFavorited: boolean` field (resolved per-request from the junction table) |
| List reports endpoint | Support `?favorited=true` query parameter to filter by favorited reports |

### Scope of work

| Layer | File(s) | Change |
|-------|---------|--------|
| TypeSpec | `api/models/dynamic-reports.tsp` | Add `isFavorited: boolean` to `DynamicReport` and `DynamicReportSummary` |
| Django models | `models/favorite.py` (new) | `DynamicReportFavorite` junction table |
| Migrations | `migrations/000N_…` | New migration for the junction table |
| Services | `services/reports.py` | Update `compute_available_actions()`, add `case "favorite"` to `perform_action()` |
| Schemas | `schemas/reports.py` | Add `is_favorited: bool` to response schemas |
| API | `api/reports.py` | Annotate responses with `is_favorited` (query junction table per request user) |
| List endpoint | `api/reports.py` | Accept `favorited: bool` query param, filter accordingly |
| Tests | `tests/test_reports_api.py` | Favorite/unfavorite toggle, list filtering |

---

## 3. Timeline and priority

From the UI team's perspective:

| Item | Blocks UI phase | Priority |
|------|----------------|----------|
| **Pivot definition persistence** (§1) | Phase 6 — save/load round-trip with pivot config | **High** — without this, pivot reports cannot be saved and restored |
| **Favorite action** (§2) | Phase 6 — Actions menu completeness | **Medium** — the UI can hide the favorite toggle until the backend is ready; all other actions already work |

We can develop Phases 1–5 of the UI MVP without either change. Phase 6
(orchestrator + save/load + Actions menu) is where both are needed. We'd
appreciate having §1 landed before the UI enters Phase 6 integration
testing.

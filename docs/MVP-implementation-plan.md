# Sanjaya — Implementation Plan

> Dynamic reporting platform for Django, with pluggable data providers.

## Architecture Overview

Three packages, three concerns:

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| **sanjaya-core** | Provider ABC, shared Pydantic types, `MockDataProvider` | pydantic (no Django) |
| **sanjaya** | Django Ninja app — API endpoints, saved-report models, provider registry, AG Grid translation, export | Django, django-ninja, sanjaya-core, openpyxl |
| **sanjaya-sqlalchemy** | `SQLAlchemyDataProvider` — turns provider calls into SA Core SQL | sqlalchemy, sanjaya-core (no Django) |

```
┌─────────────────────────────────────────────────────────────┐
│  Host Django Project (e.g. EWI)                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  sanjaya (Django app)                                 │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ Ninja API   │  │ Registry │  │ AG Grid ↔ Core   │  │  │
│  │  │ routers     │→ │ (Python) │→ │ translation      │  │  │
│  │  └────────────┘  └──────────┘  └──────────────────┘  │  │
│  │         │                             │               │  │
│  │         ▼                             ▼               │  │
│  │  ┌────────────┐              ┌─────────────────┐     │  │
│  │  │ Django ORM │              │ DataProvider ABC │     │  │
│  │  │ (reports,  │              │ (sanjaya-core)   │     │  │
│  │  │  shares)   │              └────────┬────────┘     │  │
│  │  └────────────┘                       │              │  │
│  └───────────────────────────────────────│──────────────┘  │
│                                          │                  │
│  ┌───────────────────┐  ┌───────────────┴────────────┐    │
│  │ MockDataProvider   │  │ SQLAlchemyDataProvider      │    │
│  │ (sanjaya-core)     │  │ (sanjaya-sqlalchemy)        │    │
│  └───────────────────┘  └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Dataset configuration (Python as config language)

Users define datasets as Python objects in a module of their choosing.
Sanjaya discovers them at startup via `SANJAYA_PROVIDERS` in Django settings.

```python
# myproject/reporting/datasets.py

from sqlalchemy import select, func
from sanjaya_sqlalchemy import SQLAlchemyDataset
from myproject.db import trades, counterparties  # SA Table objects

trade_activity = SQLAlchemyDataset(
    key="trade_activity",
    label="Trade Activity",
    source=select(
        trades.c.trade_date,
        trades.c.notional,
        trades.c.currency,
        counterparties.c.name.label("counterparty"),
    ).join(counterparties, trades.c.cp_id == counterparties.c.id),
    columns=[...],  # optional overrides for labels, format hints, filter styles
)

# callable form for deferred construction
def portfolio_returns(engine):
    meta = MetaData()
    meta.reflect(engine, only=["monthly_returns"])
    t = meta.tables["monthly_returns"]
    return SQLAlchemyDataset(
        key="portfolio_returns",
        label="Portfolio Returns",
        source=select(t),
    )


def register(registry):
    """Called by sanjaya at startup."""
    registry.add(trade_activity)
    registry.add_lazy(portfolio_returns)  # resolved on first access
```

```python
# settings.py
SANJAYA_PROVIDERS = [
    "myproject.reporting.datasets",
]

# Optional: default SA engine for all SQLAlchemyDatasets
# Falls back to Django DATABASES["default"] if omitted.
SANJAYA_SQLALCHEMY_ENGINE = "postgresql://..."
```

---

## Phase 1 — `sanjaya-core`: shared types and provider interface

**Goal:** A standalone, pip-installable package that defines everything a data
provider needs — no Django, no SQLAlchemy.

### 1.1 Package scaffold

```
packages/sanjaya-core/
├── pyproject.toml
├── src/
│   └── sanjaya_core/
│       ├── __init__.py
│       ├── types.py          # Pydantic models
│       ├── enums.py          # shared enums
│       ├── filters.py        # FilterCondition, FilterGroup
│       ├── provider.py       # DataProvider ABC
│       ├── context.py        # RequestContext
│       ├── exceptions.py     # ProviderError, DatasetNotFound, etc.
│       └── mock.py           # MockDataProvider
└── tests/
    ├── test_filters.py
    ├── test_mock_provider.py
    └── conftest.py
```

### 1.2 Shared enums

Mirrors from the TypeSpec spec:

- `ColumnType` — string, number, currency, percentage, date, datetime, boolean
- `FilterOperator` — eq, neq, gt, lt, gte, lte, contains, startswith, endswith,
  is_null, is_not_null, between, in_
- `FilterCombinator` — and_, or_
- `FilterStyle` — operators, select
- `AggFunc` — sum, avg, min, max, count, distinct_count
- `ExportFormat` — csv, xlsx
- `FormatHintKind` — string, number, integer, boolean, date, datetime, currency,
  percentage, basis_points
- `SortDirection` — asc, desc

### 1.3 Pydantic models (types.py / filters.py)

**Column metadata:**
- `ColumnMeta` — name, label, type, nullable, operators, format_hints,
  currency_options, pivot_options, filter_style, enum_values
- `FormatHints` — kind, decimals, currency_code, currency_code_column
- `CurrencyOptions` — default_unit, supported_units, default_magnitude, supported_magnitudes
- `PivotOptions` — role ("dimension" | "measure"), allowed_aggs

**Filtering:**
- `FilterCondition` — column, operator, value, negate
- `FilterGroup` — combinator, negate, conditions, groups (recursive)

**Sorting:**
- `SortSpec` — column, direction

**Aggregation (grid-agnostic):**
- `ValueSpec` — column, agg_func, label

**Results:**
- `TabularResult` — columns: list[str], rows: list[dict], total: int | None
- `AggregateResult` — columns: list[AggregateColumn], rows: list[dict],
  total: int | None
- `AggregateColumn` — key, header, type, pivot_keys (for reconstructing the
  cross-tab header hierarchy)

**Context:**
- `RequestContext` — user_id, tenant_id, permissions: list[str], extra: dict

### 1.4 DataProvider ABC

```python
class DataProvider(ABC):
    key: str
    label: str
    description: str = ""
    capabilities: DatasetCapabilities  # e.g. { pivot: True }

    @abstractmethod
    def get_columns(self) -> list[ColumnMeta]: ...

    @abstractmethod
    def query(
        self,
        selected_columns: list[str],
        filter_group: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int = 100,
        offset: int = 0,
        ctx: RequestContext | None = None,
    ) -> TabularResult: ...

    @abstractmethod
    def aggregate(
        self,
        group_by_rows: list[str],
        group_by_cols: list[str],
        values: list[ValueSpec],
        filter_group: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int = 0,
        ctx: RequestContext | None = None,
    ) -> AggregateResult: ...
```

### 1.5 MockDataProvider

In-memory implementation backed by a list of dicts. Supports:
- Column filtering (projection)
- `FilterGroup` evaluation (recursive, all operators)
- Sorting (multi-column)
- Pagination (limit/offset)
- Aggregation (group-by + agg funcs on in-memory data)

Used for testing both `sanjaya-core` itself and the `sanjaya` Django app
without needing a real database.

### 1.6 Deliverables

- [ ] Package builds and installs (`pip install -e packages/sanjaya-core`)
- [ ] Full test coverage for filter evaluation, mock provider, and model
      serialization
- [ ] No Django or SQLAlchemy imports anywhere

---

## Phase 2 — `sanjaya`: Django Ninja app

**Goal:** A reusable Django app that exposes the reporting API, manages saved
reports, and delegates data operations to registered providers.

### 2.1 Package scaffold

```
packages/sanjaya/
├── pyproject.toml
├── src/
│   └── sanjaya/
│       ├── __init__.py
│       ├── apps.py               # AppConfig — discovers providers
│       ├── registry.py           # ProviderRegistry
│       ├── api/
│       │   ├── __init__.py       # root router
│       │   ├── datasets.py       # /datasets endpoints
│       │   ├── reports.py        # /reports CRUD + lifecycle + sharing
│       │   ├── pivot.py          # /datasets/{key}/pivot (AG Grid SSRM)
│       │   └── export.py         # /datasets/{key}/export
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── datasets.py       # response schemas for datasets/columns
│       │   ├── reports.py        # request/response schemas for reports
│       │   ├── pivot.py          # AG Grid request/response schemas
│       │   ├── export.py         # export request schema
│       │   ├── filters.py        # filter schemas (wire ↔ core translation)
│       │   └── errors.py         # error envelope schemas
│       ├── services/
│       │   ├── __init__.py
│       │   ├── pivot.py          # AG Grid ↔ core translation logic
│       │   ├── export.py         # CSV/XLSX rendering
│       │   └── reports.py        # report lifecycle + permission logic
│       ├── models/
│       │   ├── __init__.py
│       │   ├── report.py         # DynamicReport ORM model
│       │   └── sharing.py        # DynamicReportUserShare, GroupShare
│       ├── migrations/
│       │   └── 0001_initial.py
│       └── conf.py               # settings helpers (SANJAYA_PROVIDERS, etc.)
└── tests/
    ├── conftest.py               # Django test setup, mock provider fixture
    ├── test_datasets_api.py
    ├── test_reports_api.py
    ├── test_pivot_api.py
    ├── test_export_api.py
    └── test_registry.py
```

### 2.2 Provider registry

```python
class ProviderRegistry:
    _providers: dict[str, DataProvider]
    _lazy: dict[str, Callable[[Engine | None], DataProvider]]

    def add(self, provider: DataProvider) -> None: ...
    def add_lazy(self, factory: Callable, key: str | None = None) -> None: ...
    def get(self, dataset_key: str) -> DataProvider: ...
    def list_datasets(self) -> list[DatasetSummary]: ...

registry = ProviderRegistry()  # module-level singleton
```

Discovery in `AppConfig.ready()`:
1. Read `settings.SANJAYA_PROVIDERS` (list of dotted module paths).
2. Import each module.
3. If module has `register(registry)`, call it.
4. Otherwise, scan module-level attributes for `DataProvider` instances and
   auto-register them.

### 2.3 API routers

All routers are mounted under a single `Router()` that the host project adds
to its `NinjaAPI`. Sanjaya does **not** create its own `NinjaAPI` instance.

#### Datasets router

| Method | Path | Description |
|--------|------|-------------|
| GET | `/datasets` | List registered datasets |
| GET | `/datasets/{dataset_key}/columns` | Column metadata |
| POST | `/datasets/{dataset_key}/preview` | Flat tabular preview |

#### Pivot router

| Method | Path | Description |
|--------|------|-------------|
| POST | `/datasets/{dataset_key}/pivot` | AG Grid SSRM pivot endpoint |

Accepts `IServerSideGetRowsRequest` shape. Translation service converts to
provider `aggregate()` call and formats response as
`{ rowData, rowCount, pivotResultFields }`.

#### Export router

| Method | Path | Description |
|--------|------|-------------|
| POST | `/datasets/{dataset_key}/export` | Server-driven CSV/XLSX export |

Accepts flat (columns + filters) or pivot parameters. Materialises the full
result, renders to the requested format, returns as `StreamingHttpResponse`.
Pivot exports produce a human-readable cross-tab, not AG Grid's flat row shape.

#### Reports router

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports` | List saved reports (filter/sort/page) |
| POST | `/reports` | Create report |
| GET | `/reports/{id}` | Get report |
| PATCH | `/reports/{id}` | Update report |
| GET | `/reports/{id}/actions` | Available lifecycle actions |
| POST | `/reports/{id}/actions` | Perform action (publish, archive, etc.) |
| GET | `/reports/stats` | Aggregate stats |
| GET | `/reports/{id}/shares` | List shares |
| POST | `/reports/{id}/shares/users` | Upsert user share |
| DELETE | `/reports/{id}/shares/users` | Remove user share |
| POST | `/reports/{id}/shares/groups` | Upsert group share |
| DELETE | `/reports/{id}/shares/groups` | Remove group share |

### 2.4 AG Grid ↔ Core translation (`services/pivot.py`)

This is the seam between the AG Grid wire format and the grid-agnostic provider
interface. Isolated here so:
- The provider ABC never sees AG Grid types.
- A future non-AG-Grid consumer could introduce a different endpoint that calls
  the same provider.

**Inbound translation** (AG Grid request → provider args):

| AG Grid field | Provider arg |
|---------------|-------------|
| `rowGroupCols` | `group_by_rows` (list of column names) |
| `pivotCols` | `group_by_cols` (list of column names) |
| `valueCols` | `values` (list of `ValueSpec`, mapping `aggFunc` → `AggFunc`) |
| `groupKeys` | Injected as equality filters prepended to `filter_group` |
| `filterModel` | Translated to `FilterGroup` tree |
| `sortModel` | `sort` (list of `SortSpec`) |
| `startRow` / `endRow` | `offset` / `limit` |

**Outbound translation** (provider result → AG Grid response):

| Provider result | AG Grid field |
|-----------------|---------------|
| `AggregateResult.rows` | `rowData` |
| `AggregateResult.total` | `rowCount` |
| `AggregateResult.columns` (dynamic pivot cols) | `pivotResultFields` (underscore-joined key paths) |

### 2.5 Export service (`services/export.py`)

- **Flat export:** Calls `provider.query()` with `limit=None` (all rows),
  streams through `csv.writer` or `openpyxl` Workbook.
- **Pivot export:** Calls `provider.aggregate()` with no offset/limit, then
  reshapes `AggregateResult` into a cross-tab matrix (row groups as rows,
  pivot column groups as hierarchical headers) and writes to a sheet. For
  XLSX, uses `openpyxl` merged cells for header hierarchy. For CSV, flattens
  the header hierarchy into a single row.

### 2.6 Django models

Two models, intentionally minimal — sanjaya does **not** own user/group models:

**`DynamicReport`** — id, title, description, status (draft/published/archived),
created_by (FK → `settings.AUTH_USER_MODEL`), created_at, updated_by, updated_at,
published_at, published_by, archived_at, version, tags (JSONField),
metadata (JSONField containing `datasetKey`, `definition`).

**`DynamicReportUserShare`** — report (FK), user (FK), permission (viewer/editor/owner).

**`DynamicReportGroupShare`** — report (FK), group (FK → `auth.Group`), permission.

### 2.7 Auth / permissions approach

Sanjaya **does not** own authentication. It relies on `request.user` being
populated by the host project's middleware. Sanjaya **does** own:

- Report-level permission resolution (owner → global perms → explicit shares),
  matching the logic described in `permissions.md`.
- Django permission codenames: `sanjaya.view_any`, `sanjaya.edit_any`,
  `sanjaya.publish_any`, `sanjaya.destroy_any`, `sanjaya.manage_shares_any`,
  `sanjaya.transfer_ownership_any`.
- Dataset endpoints require only `request.user.is_authenticated`.

### 2.8 Deliverables

- [ ] Django app installs and can be added to `INSTALLED_APPS`
- [ ] All routers return correct responses against `MockDataProvider`
- [ ] Reports CRUD with lifecycle transitions
- [ ] Sharing with permission resolution
- [ ] AG Grid pivot request/response round-trip tested
- [ ] Export produces valid CSV and XLSX (flat and pivot)
- [ ] Migrations for report and share models

---

## Phase 3 — `sanjaya-sqlalchemy`: SA Core data provider

**Goal:** A provider implementation that turns `query()` and `aggregate()` into
efficient SQL via SQLAlchemy Core, supporting any SA-supported DBMS.

### 3.1 Package scaffold

```
packages/sanjaya-sqlalchemy/
├── pyproject.toml
├── src/
│   └── sanjaya_sqlalchemy/
│       ├── __init__.py
│       ├── dataset.py         # SQLAlchemyDataset (config object)
│       ├── provider.py        # SQLAlchemyDataProvider (implements ABC)
│       ├── query_builder.py   # filter → SA where clause, sort, pagination
│       ├── pivot_builder.py   # aggregate → GROUP BY + pivot SQL
│       ├── column_inference.py # infer ColumnMeta from SA column types
│       └── engine.py          # engine resolution helpers
└── tests/
    ├── conftest.py            # in-memory SQLite fixtures
    ├── test_query_builder.py
    ├── test_pivot_builder.py
    ├── test_provider.py
    └── test_column_inference.py
```

### 3.2 `SQLAlchemyDataset`

Configuration object (not the provider itself). Holds:

```python
@dataclass
class SQLAlchemyDataset:
    key: str
    label: str
    source: SelectBase | Callable[[Engine], SelectBase] | str
    description: str = ""
    columns: list[ColumnMeta] | None = None      # override inferred metadata
    capabilities: DatasetCapabilities = field(default_factory=lambda: DatasetCapabilities(pivot=True))
    engine: Engine | str | None = None            # per-dataset override
```

- `source` as `SelectBase`: a pre-built SA Core `select()`.
- `source` as `Callable[[Engine], SelectBase]`: deferred — called with the
  resolved engine on first access.
- `source` as `str`: treated as raw SQL, wrapped in `text()` and used as a
  subquery (`select().select_from(text(source).subquery())`).

### 3.3 `SQLAlchemyDataProvider`

Wraps a `SQLAlchemyDataset` and implements `DataProvider`:

- **Engine resolution order:** dataset-level `engine` → `SANJAYA_SQLALCHEMY_ENGINE`
  setting → `create_engine` from Django `DATABASES["default"]`.
- **`get_columns()`:** If `dataset.columns` is provided, use it. Otherwise,
  compile `dataset.source` against the engine, inspect result columns, and
  map SA types to `ColumnMeta` (via `column_inference.py`).
- **`query()`:** Build `select(selected_cols).select_from(source_subquery)`,
  apply `WHERE` from `FilterGroup`, `ORDER BY` from `SortSpec`, `LIMIT`/`OFFSET`.
  Execute and return `TabularResult`.
- **`aggregate()`:** Build `select(group_cols + agg_exprs).select_from(source_subquery).group_by(group_cols)`,
  apply `WHERE`, `ORDER BY`, `LIMIT`/`OFFSET`. For pivot: `group_by_cols` become
  additional group-by dimensions; the service layer in `sanjaya` handles
  reshaping the flat grouped result into the pivot column layout.

### 3.4 Query building details

**`query_builder.py`:**
- `FilterCondition` → SA `column.op(value)` with mapping for each `FilterOperator`.
- `FilterGroup` → `and_()` / `or_()` with recursive descent.
- Negation (`not`) → `~clause`.
- `SortSpec` → `column.asc()` / `column.desc()`.

**`pivot_builder.py`:**
- `group_by_rows` + `group_by_cols` → combined `GROUP BY` clause.
- `ValueSpec` → `func.sum(col)`, `func.avg(col)`, etc.
- Result is a flat grouped result; the pivot column reshaping (turning row
  values of pivot columns into separate result columns) happens in
  `sanjaya`'s `services/pivot.py`, not here. This keeps the provider simple
  and DBMS-agnostic (no `PIVOT`/`CROSSTAB` dialect-specific SQL).

### 3.5 Deliverables

- [ ] Package builds and installs
- [ ] Filter translation covers all operators
- [ ] Aggregation produces correct SQL for all agg funcs
- [ ] Column inference works for common SA types
- [ ] Tests pass against in-memory SQLite
- [ ] Deferred source (callable) and raw SQL string forms tested
- [ ] No Django imports anywhere

---

## Phase 4 — Integration, testing, and TypeSpec alignment

**Goal:** End-to-end integration testing, TypeSpec spec updates, and polish.

### 4.1 Integration test harness

- Django test project in `tests/integration/` that installs `sanjaya` as an
  app with `MockDataProvider` and optionally `SQLAlchemyDataProvider` (SQLite).
- Test full request/response cycles through Django's test client.
- Test AG Grid pivot round-trips with realistic multi-level grouping + pivoting.
- Test export output (parse CSV, inspect XLSX with openpyxl).

### 4.2 TypeSpec spec updates

Update the TypeSpec models to reflect the final Python implementation:

- Replace custom `PivotRequest`/`PivotPreviewResponse` with AG Grid SSRM
  request/response shapes.
- Ensure error envelope models match Django Ninja's actual validation error
  format.
- Add export response documentation (binary stream, content-type headers).

### 4.3 Documentation

- README for each package with installation and quickstart.
- Dataset configuration guide (Python config examples).
- AG Grid integration guide (front-end code showing how to wire the
  datasource).

### 4.4 Deliverables

- [ ] End-to-end tests pass
- [ ] TypeSpec spec aligned with implementation
- [ ] Package READMEs written
- [ ] All three packages installable from the monorepo

---

## Phasing summary

| Phase | Package | Key outcome |
|-------|---------|-------------|
| **1** | sanjaya-core | Provider ABC + types + MockDataProvider |
| **2** | sanjaya | Django app with full API, registry, AG Grid pivot, export |
| **3** | sanjaya-sqlalchemy | SA Core provider with query + aggregate SQL generation |
| **4** | (all) | Integration tests, TypeSpec updates, documentation |

Each phase is independently testable. Phase 2 can be developed and tested
entirely against `MockDataProvider` (from Phase 1) before Phase 3 exists.

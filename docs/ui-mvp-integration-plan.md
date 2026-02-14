# Sanjaya UI — Integration & Demo Plan

> Continuation of the [UI MVP plan](ui-mvp-plan.md) (Phases 1–6 complete).
> This document breaks the original Phase 7 into four deliverable sub-phases
> that stand up a real backend, add an AG Grid data-viewer component, and
> build two demo applications (vanilla TypeScript and React + MUI).

---

## Architecture — where each piece lives

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Monorepo                                                               │
│                                                                         │
│  packages/                                                              │
│    sanjaya-core/          ← Python: provider ABC, types, filters        │
│    sanjaya-django/        ← Python: Django Ninja app (API + models)     │
│    sanjaya-sqlalchemy/    ← Python: SQLAlchemy data provider            │
│    sanjaya-ui/            ← TypeScript: web components + <sj-data-grid> │
│    build-templates/       ← Node: HTML→TS template compiler            │
│                                                                         │
│  apps/                                                                  │
│    demo-server/           ← Phase 7a: Django host project               │
│    demo-vanilla/          ← Phase 7c: vanilla TS reference app          │
│    demo-react/            ← Phase 7d: React + MUI 7 integration app    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Workspace changes

- `apps/demo-vanilla/` and `apps/demo-react/` are added to
  `pnpm-workspace.yaml` so they can depend on `@pojagi/sanjaya-ui` via
  `workspace:*`.
- `apps/demo-server/` is a Python project managed by `uv`; it is added to
  `[tool.uv.workspace].members` in the root `pyproject.toml`.

---

## Phase 7a — Django host project + Northwind MSSQL dataset

### Goal

Stand up a real runnable Django project that installs `sanjaya-django`,
runs migrations against SQLite (for report/share/favorite models), and
registers an `SQLAlchemyProvider` pointed at a Northwind-style relational
schema in the existing MSSQL docker-compose container.

### 7a.1 MSSQL seed schema — Northwind subset

The classic [Microsoft Northwind database][northwind] provides a
realistic multi-table domain without being overwhelming. We use a
simplified subset:

```
┌────────────┐       ┌──────────────┐       ┌────────────┐
│ customers  │       │ orders       │       │ products   │
├────────────┤       ├──────────────┤       ├────────────┤
│ customer_id│◄──────│ customer_id  │       │ product_id │
│ company    │       │ order_id     │──┐    │ name       │
│ contact    │       │ order_date   │  │    │ category   │
│ city       │       │ ship_country │  │    │ unit_price │
│ country    │       │ freight      │  │    │ units_stock│
└────────────┘       └──────────────┘  │    │ discontinued│
                                        │    └────────────┘
                     ┌──────────────┐  │
                     │ order_details│  │
                     ├──────────────┤  │
                     │ order_id     │◄─┘
                     │ product_id   │──────► products
                     │ unit_price   │
                     │ quantity     │
                     │ discount     │
                     └──────────────┘
```

[northwind]: https://learn.microsoft.com/en-us/dotnet/framework/data/adonet/sql/linq/downloading-sample-databases

**~80 customers, ~800 orders, ~2 000 order details, ~77 products** — enough
data to exercise pagination, grouping, pivot, and filtering without
requiring minutes of seed time.

The tables are created and seeded via a Python script
(`apps/demo-server/seed_northwind.py`) using SQLAlchemy Core, run against
the existing `docker-compose.mssql.yml` container. This keeps the seed
data version-controlled and reproducible.

### 7a.2 SQLAlchemy provider with JOINs

The dataset provider is defined in
`apps/demo-server/datasets/order_details.py`. Its `selectable` is a
joined query — not a single table:

```python
selectable = (
    sa.select(
        order_details.c.order_id,
        orders.c.order_date,
        orders.c.ship_country,
        orders.c.freight,
        customers.c.company.label("customer"),
        customers.c.city.label("customer_city"),
        customers.c.country.label("customer_country"),
        products.c.name.label("product"),
        products.c.category,
        order_details.c.unit_price,
        order_details.c.quantity,
        order_details.c.discount,
        (order_details.c.unit_price * order_details.c.quantity
         * (1 - order_details.c.discount)).label("line_total"),
    )
    .select_from(
        order_details
        .join(orders, order_details.c.order_id == orders.c.order_id)
        .join(customers, orders.c.customer_id == customers.c.customer_id)
        .join(products, order_details.c.product_id == products.c.product_id)
    )
)
```

This exercises `SQLAlchemyProvider`'s `SelectBase → .subquery()` path and
proves the provider works with multi-table JOINs, computed columns, and
label aliasing.

Column metadata is defined explicitly with:
- `pivot.role = "dimension"` on `customer`, `product`, `category`,
  `ship_country`, `customer_country`
- `pivot.role = "measure"` with `allowedAggs` on `unit_price`, `quantity`,
  `line_total`, `freight`
- `filterStyle = "select"` on `category` and `ship_country` (with
  `enumValues` populated from the data)
- `formatHints` on `unit_price` / `line_total` (currency, USD)

### 7a.3 Django project structure

```
apps/demo-server/
├── manage.py
├── pyproject.toml           # depends on sanjaya-django, sanjaya-sqlalchemy
├── demo/
│   ├── __init__.py
│   ├── settings.py          # INSTALLED_APPS includes sanjaya_django
│   ├── urls.py              # mounts Ninja API at /api/v1/reporting/
│   └── wsgi.py
├── datasets/
│   ├── __init__.py          # register() function for ProviderRegistry
│   └── order_details.py     # SQLAlchemyProvider wired to Northwind join
├── seed_northwind.py        # CLI script: create tables + insert seed data
└── README.md
```

**Django settings highlights:**

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

SANJAYA_PROVIDERS = ["datasets"]

# MSSQL connection for the data provider (not Django's ORM)
MSSQL_URL = os.environ.get(
    "SANJAYA_MSSQL_URL",
    "mssql+pyodbc://sa:Sanjaya_Test1@localhost:1433/sanjaya_test"
    "?driver=ODBC+Driver+18+for+SQL+Server"
    "&TrustServerCertificate=yes&Encrypt=no",
)
```

### 7a.4 Running it

```bash
# 1. Start MSSQL
make mssql-up

# 2. Seed Northwind data
cd apps/demo-server
uv run python seed_northwind.py

# 3. Run Django migrations (SQLite — reports, shares, favorites)
uv run python manage.py migrate

# 4. Create a superuser
uv run python manage.py createsuperuser

# 5. Run the dev server
uv run python manage.py runserver 0.0.0.0:8000
```

API is then live at `http://localhost:8000/api/v1/reporting/`.

### 7a.5 Deliverables

- [ ] `apps/demo-server/` Django project scaffolded
- [ ] `seed_northwind.py` creates tables + inserts ~3 000 rows in MSSQL
- [ ] `datasets/order_details.py` — `SQLAlchemyProvider` with 4-table JOIN
- [ ] Django migrations run cleanly against SQLite
- [ ] API serves datasets, table, pivot, export, and reports endpoints
- [ ] `README.md` with setup instructions
- [ ] Makefile target: `make demo-server`

---

## Phase 7b — `<sj-data-grid>` component

### Goal

Add a new web component to `@pojagi/sanjaya-ui` that renders AG Grid
Enterprise in two tabs ("Table" / "Pivot"), wired to `SanjayaDataClient`
as an SSRM datasource.

### Why a component, not just demo code?

The grid integration logic — building SSRM datasources, translating the
report definition into AG Grid column defs and row-group/pivot config,
handling secondary column defs from pivot responses — is non-trivial and
identical across every host. Shipping it as a reusable `<sj-data-grid>`
component means hosts get a working grid with one property assignment.

### AG Grid licensing

AG Grid Enterprise without a license key runs fully functional but
displays a watermark in the grid. This is fine for development and
demo purposes — no license key is required to build or test.

### 7b.1 Component API

```html
<sj-data-grid id="data-grid"></sj-data-grid>

<script>
  const grid = document.getElementById("data-grid");
  grid.client = client;
  grid.datasetKey = "order_details";
  grid.definition = def;
</script>
```

| Property | Type | Description |
|----------|------|-------------|
| `client` | `SanjayaDataClient` | Required — data access |
| `datasetKey` | `string \| null` | Active dataset key |
| `definition` | `DynamicReportDefinition \| null` | Current report definition (columns, filter, pivot) |
| `activeTab` | `"table" \| "pivot"` | Which tab is shown (default: `"table"`) |

Events:

| Event | Detail | When |
|-------|--------|------|
| `tab-change` | `{ tab: "table" \| "pivot" }` | User switches tabs |
| `grid-ready` | `{ api: GridApi }` | AG Grid is initialized (for host-level API access) |

### 7b.2 Internal architecture

```
src/data-grid/
├── template.html            # Tab bar + two grid container divs
├── data-grid.ts             # <sj-data-grid> orchestrator
├── helpers.ts               # Pure functions: definition → colDefs, datasource factories
└── styles.ts                # AG Grid theme integration with --sanjaya-* vars
```

**Key behaviors:**

1. **Tab rendering.** Two `<div>` containers, only the active one is
   visible. Each hosts an AG Grid instance. Grids are lazily initialized
   on first tab activation.

2. **Table datasource.** Implements `IServerSideDatasource`:
   - Maps `definition.selectedColumns` → AG Grid `colDefs`
   - Maps `definition.filter` → `request.filter` (rich FilterGroup)
   - Maps `definition.rowGroupCols` → `request.rowGroupCols`
   - Calls `client.queryTable(datasetKey, request)`
   - Returns `response.rowData` + `response.rowCount`

3. **Pivot datasource.** Same pattern but:
   - Maps `definition.pivotCols` → `request.pivotCols`, sets
     `pivotMode: true`
   - Maps `definition.valueCols` → `request.valueCols` with `aggFunc`
   - On response, applies `secondaryColDefs` to the grid via
     `gridApi.updateGridOptions({ columnDefs: ... })`

4. **Refresh on definition change.** When the `definition` property
   changes (host listens to `report-definition-change` from
   `<sj-report-builder>` and passes the new definition down), the
   component calls `gridApi.refreshServerSide({ purge: true })` to
   re-fetch data with the updated filters/columns/pivot config.

5. **AG Grid theme.** Use AG Grid's `themeQuartz` (the default theme in
   v32) and map `--sanjaya-*` CSS vars to AG Grid's `--ag-*` vars so the
   grid matches the host's theme.

### 7b.3 Deliverables

- [ ] `<sj-data-grid>` registered as `sj-data-grid`
- [ ] Table tab with SSRM datasource → `client.queryTable()`
- [ ] Pivot tab with SSRM datasource → `client.queryPivot()`
- [ ] Lazy grid initialization (only when tab first activated)
- [ ] Definition-driven refresh (`selectedColumns`, `filter`, pivot config)
- [ ] `secondaryColDefs` applied from pivot response
- [ ] AG Grid theme mapped to `--sanjaya-*` CSS variables
- [ ] Tab-change event
- [ ] `ag-grid-enterprise` added as a peer dependency
- [ ] Tests: datasource construction, definition → colDef mapping,
  tab switching (unit tests with mocked grid API)

---

## Phase 7c — Vanilla TypeScript reference application

### Goal

Build a minimal, zero-framework demo app using plain TypeScript that
composes `<sj-report-builder>` and `<sj-data-grid>` on a single page.
This serves as the **reference implementation** showing exactly how a host
integrates the components.

### 7c.1 Project structure

```
apps/demo-vanilla/
├── package.json             # depends on @pojagi/sanjaya-ui (workspace:*)
├── tsconfig.json            # strict, ESM, ES2022
├── index.html               # entry point
├── src/
│   ├── main.ts              # bootstrap: create client, wire components
│   ├── client.ts            # SanjayaDataClient implementation (fetch wrapper)
│   └── style.css            # minimal layout + sanjaya light theme import
└── README.md
```

**Bundler:** Vite in vanilla-ts mode (zero framework config). The
`index.html` is the entry point; Vite handles TS compilation, HMR, and
dev serving.

### 7c.2 `SanjayaDataClient` implementation

A thin `fetch` wrapper against the Django demo server (Phase 7a):

```typescript
const BASE = "http://localhost:8000/api/v1/reporting";

export function createClient(): SanjayaDataClient {
  return {
    async listDatasets() {
      const res = await fetch(`${BASE}/datasets`);
      return (await res.json()).datasets;
    },
    async getColumns(key) {
      const res = await fetch(`${BASE}/datasets/${key}/columns`);
      return (await res.json()).columns;
    },
    async queryTable(key, request) {
      const res = await fetch(`${BASE}/datasets/${key}/table`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return res.json();
    },
    // … remaining methods follow the same pattern
  };
}
```

### 7c.3 Page layout

The app uses a sidebar + main content layout. The sidebar is on the left
and contains the report-builder panels as **vertical tabs** (text
rotated 90°). Clicking a tab expands the sidebar to reveal that panel;
clicking the same tab again collapses the sidebar. Clicking a different
tab switches panels without collapsing. The sidebar is **draggable to
resize** via a handle on its right edge.

```
┌─┬──────────────────────────────────────────────────┐
│D│                                                  │
│a│  <sj-data-grid>                                  │
│t│  ┌─────────┬──────────┐                          │
│a│  │  Table  │  Pivot   │                          │
│s│  ├─────────┴──────────┤                          │
│e│  │                    │                          │
│t│  │                    │                          │
│ │  │    AG Grid SSRM    │                          │
│C│  │                    │                          │
│o│  │                    │                          │
│l│  └────────────────────┘                          │
│u│                                                  │
│m│                                                  │
│n│                                                  │
│s│                                                  │
│ │                                                  │
│F│                                                  │
│i│                                                  │
│l│                                                  │
│t│                                                  │
│e│                                                  │
│r│                                                  │
│s│                                                  │
│ │                                                  │
│P│                                                  │
│i│                                                  │
│v│                                                  │
│o│                                                  │
│t│                                                  │
└─┴──────────────────────────────────────────────────┘
         ↕ collapsed state (tabs only, ~40 px)

┌──────────────────┬─┬───────────────────────────────┐
│  <sj-report-     │↔│                               │
│   builder>       │ │  <sj-data-grid>               │
│                  │r│  ┌─────────┬──────────┐       │
│  ┌────────────┐  │e│  │  Table  │  Pivot   │       │
│  │ Columns    │  │s│  ├─────────┴──────────┤       │
│  │ ☑ order_id │  │i│  │                    │       │
│  │ ☑ product  │  │z│  │   AG Grid SSRM     │       │
│  │ ☑ quantity │  │e│  │                    │       │
│  │   …        │  │ │  │                    │       │
│  └────────────┘  │ │  └────────────────────┘       │
│                  │ │                               │
└──────────────────┴─┴───────────────────────────────┘
         ↕ expanded state (one panel visible, draggable width)
```

Sidebar behavior is handled by the **host app layout** (plain CSS +
a small amount of TypeScript for resize dragging and tab toggling), not
by `<sj-report-builder>` itself. The report builder remains a
layout-agnostic block element — the host decides how to present it.

The report builder emits `report-definition-change` → the host passes
the new definition to `<sj-data-grid>`:

```typescript
const builder = document.querySelector("sj-report-builder")!;
const grid = document.querySelector("sj-data-grid")!;

builder.addEventListener("report-definition-change", (e) => {
  grid.definition = e.detail;
});

builder.addEventListener("dataset-change", (e) => {
  grid.datasetKey = e.detail.key;
});
```

### 7c.4 Deliverables

- [ ] `apps/demo-vanilla/` Vite + TypeScript project
- [ ] `SanjayaDataClient` fetch implementation
- [ ] Report builder + data grid composed on one page
- [ ] Events wired: definition changes refresh the grid
- [ ] Light theme applied via CSS import
- [ ] `README.md` with `pnpm dev` instructions
- [ ] Added to `pnpm-workspace.yaml`

---

## Phase 7d — React + MUI 7 integration application

### Goal

Build the same demo as Phase 7c but using React 18 + MUI 7 +
`ag-grid-react` to validate theming integration and provide a
production-style reference for the consuming team.

### 7d.1 Project structure

```
apps/demo-react/
├── package.json             # react, @mui/material ^7.2.0, ag-grid-react ^32
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx             # React root
│   ├── App.tsx              # layout: MUI AppBar + builder + grid
│   ├── client.ts            # same SanjayaDataClient as vanilla (shared or copy)
│   ├── hooks/
│   │   └── useSanjayaTheme.ts   # maps MUI theme → --sanjaya-* CSS vars
│   ├── components/
│   │   ├── SanjayaReportBuilder.tsx  # React wrapper for <sj-report-builder>
│   │   └── SanjayaDataGrid.tsx       # React wrapper for <sj-data-grid>
│   └── theme.ts             # MUI createTheme() customization
└── README.md
```

### 7d.2 React wrappers

Thin components that forward React props to custom element properties
and subscribe to custom events:

```tsx
function SanjayaReportBuilder({
  client,
  reportId,
  onDefinitionChange,
  onAction,
}: Props) {
  const ref = useRef<SanjayaReportBuilderElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.client = client;
  }, [client]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: CustomEvent) => onDefinitionChange?.(e.detail);
    el.addEventListener("report-definition-change", handler);
    return () => el.removeEventListener("report-definition-change", handler);
  }, [onDefinitionChange]);

  return <sj-report-builder ref={ref} />;
}
```

### 7d.3 MUI theme → `--sanjaya-*` mapping

```typescript
export function useSanjayaTheme(): React.CSSProperties {
  const theme = useTheme();
  return {
    "--sanjaya-color-primary": theme.palette.primary.main,
    "--sanjaya-color-primary-hover": theme.palette.action.hover,
    "--sanjaya-color-surface": theme.palette.background.paper,
    "--sanjaya-color-on-surface": theme.palette.text.primary,
    "--sanjaya-color-border": theme.palette.divider,
    "--sanjaya-color-error": theme.palette.error.main,
    "--sanjaya-font-family": theme.typography.fontFamily,
    "--sanjaya-radius-sm": `${theme.shape.borderRadius}px`,
    "--sanjaya-radius-md": `${theme.shape.borderRadius * 1.5}px`,
    // …
  } as React.CSSProperties;
}
```

Applied via a wrapper `<div>`:

```tsx
<div style={useSanjayaTheme()}>
  <SanjayaReportBuilder client={client} ... />
  <SanjayaDataGrid client={client} ... />
</div>
```

### 7d.4 Visual comparison

Both the vanilla TS app (Phase 7c) and the React app (Phase 7d) point
at the same Django backend (Phase 7a) and render the same Northwind
dataset. Running them side by side validates:

- Components render identically in both environments
- MUI theme mapping produces visually coherent results
- AG Grid theme integration works with `--sanjaya-*` variables
- Event wiring patterns are correct for both paradigms

### 7d.5 Deliverables

- [ ] `apps/demo-react/` Vite + React 18 + MUI 7.2.0 project
- [ ] React wrapper components for `<sj-report-builder>` and `<sj-data-grid>`
- [ ] `useSanjayaTheme()` hook mapping MUI palette → CSS vars
- [ ] Same `SanjayaDataClient` implementation as vanilla app
- [ ] MUI AppBar layout with the full builder + grid
- [ ] AG Grid Enterprise via `ag-grid-react` ^32
- [ ] `README.md` with `pnpm dev` instructions
- [ ] Added to `pnpm-workspace.yaml`

---

## Phasing summary

| Phase | Deliverable | Key outcome |
|-------|-------------|-------------|
| **7a** | Django host + Northwind MSSQL | Real backend serving the full Sanjaya API with multi-table JOINed data |
| **7b** | `<sj-data-grid>` component | AG Grid SSRM in Table + Pivot tabs, definition-driven refresh |
| **7c** | Vanilla TS reference app | Zero-framework integration proof; reference implementation |
| **7d** | React + MUI 7 app | Production-style integration; MUI theme mapping; visual comparison |

Each phase builds on the prior. Phase 7a can be tested independently
via `curl` / Postman. Phases 7c and 7d both require 7a running as the
backend and 7b merged into `@pojagi/sanjaya-ui`.

---

## Dependencies

| Dependency | Version | Where used |
|------------|---------|------------|
| `ag-grid-enterprise` | ^32.0.0 | 7b (peer dep), 7c, 7d |
| `ag-grid-react` | ^32.0.0 | 7d only |
| `@mui/material` | ^7.2.0 | 7d only |
| `react` / `react-dom` | ^18.3.1 | 7d only |
| `vite` | ^6 | 7c, 7d (dev server + bundler) |
| `sanjaya-django` | workspace | 7a |
| `sanjaya-sqlalchemy` | workspace | 7a |
| `pyodbc` | ≥5 | 7a (MSSQL driver) |
| `@pojagi/sanjaya-ui` | workspace:* | 7b, 7c, 7d |

# Sanjaya UI — React + MUI Integration Plan

> How to wire up the `@pojagi/sanjaya-ui` component library to a running
> Sanjaya backend. This document covers the **demo React app**
> (`apps/demo-react/`) that targets the existing demo server, plus
> guidance for production host applications.

Companion document: [UI MVP Plan](ui-mvp-plan.md).

---

## Quick reference: demo server

The demo server (`apps/demo-server/`) is a Django project that exposes
the Sanjaya API at `http://localhost:8000/api/v1/reporting/`. It ships
with a Northwind-style `order_details` dataset backed by MSSQL and uses
SQLite for report/share/favorite storage.

Starting it:

```bash
make mssql-up        # Start MSSQL container
make demo-seed       # Seed Northwind data
make demo-migrate    # Run Django migrations
make demo-server     # Start on :8000
```

CORS is pre-configured for `localhost:5173` and `:5174`.

---

## Phase 8a — Demo React application (`apps/demo-react/`)

A minimal Vite + React SPA that imports `@pojagi/sanjaya-ui` components
and provides a fetch-based `SanjayaClient` targeting the demo server.
This app exists solely for development and testing — it is **not**
published.

### Scaffold

```
apps/demo-react/
├── index.html
├── package.json          # @pojagi/demo-react (private: true)
├── tsconfig.json
├── vite.config.ts
├── README.md
├── src/
│   ├── main.tsx          # ReactDOM.createRoot, AG Grid module registration
│   ├── App.tsx           # ThemeProvider + SanjayaProvider + layout
│   ├── client.ts         # Fetch-based SanjayaClient implementation
│   └── vite-env.d.ts     # Vite client types
```

### Key design decisions

1. **`client.ts` — fetch-based `SanjayaClient`**

   A reference implementation of the `SanjayaClient` interface using the
   browser `fetch` API. Every method follows the same pattern:

   ```ts
   const BASE = "http://localhost:8000/api/v1/reporting";

   async function listDatasets(): Promise<DatasetsResponse> {
     const res = await fetch(`${BASE}/datasets/`);
     if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
     return res.json();
   }
   ```

   This implementation lives in the **demo app**, not in the library.
   Production host apps will use their own HTTP stack (Axios, `ky`,
   `openapi-fetch`, React Query wrappers, etc.).

2. **No authentication in the demo**

   The demo server uses `AutoAuthMiddleware` to auto-authenticate all
   requests as a superuser. The demo client therefore sends no auth
   headers. Production hosts will inject tokens, cookies, or CSRF headers
   in their own `SanjayaClient`.

3. **AG Grid Enterprise module registration**

   AG Grid Enterprise modules are registered once in `main.tsx`:

   ```ts
   import { ModuleRegistry } from "ag-grid-community";
   import { AllEnterpriseModule } from "ag-grid-enterprise";
   ModuleRegistry.registerModules([AllEnterpriseModule]);
   // LicenseManager.setLicenseKey("..."); if the host has a key
   ```

   The `@pojagi/sanjaya-ui` library **never** calls
   `ModuleRegistry.registerModules` — that is the host's responsibility.

4. **MUI theme**

   The demo app creates a default MUI theme. The library inherits whatever
   `ThemeProvider` the host wraps it in — it never creates its own theme.

### `package.json` dependencies

```json
{
  "private": true,
  "name": "@pojagi/demo-react",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@mui/material": "^7.2.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "ag-grid-react": "^32.0.0",
    "ag-grid-community": "^32.0.0",
    "ag-grid-enterprise": "^32.0.0",
    "@pojagi/sanjaya-ui": "workspace:*"
  },
  "devDependencies": {
    "typescript": "~5.8.0",
    "vite": "^6.3.0",
    "@vitejs/plugin-react": "^4.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

The `workspace:*` protocol links to the local `@pojagi/sanjaya-ui`
package via pnpm workspace — no need to publish first.

### `App.tsx` layout

```tsx
import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
import { SanjayaProvider, ReportBuilder } from "@pojagi/sanjaya-ui";
import { sanjayaClient } from "./client";

const theme = createTheme();

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SanjayaProvider client={sanjayaClient}>
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <ReportBuilder />
        </Box>
      </SanjayaProvider>
    </ThemeProvider>
  );
}
```

### Running the demo

```bash
# Terminal 1: backend
make demo-server

# Terminal 2: frontend
pnpm --filter @pojagi/demo-react dev
# → http://localhost:5173
```

### 8a deliverables

- [ ] `apps/demo-react/` scaffold
- [ ] Fetch-based `SanjayaClient` (all methods)
- [ ] AG Grid module registration in `main.tsx`
- [ ] `App.tsx` with `ThemeProvider` + `SanjayaProvider` + `ReportBuilder`
- [ ] README with quick-start instructions
- [ ] Verify end-to-end: dataset list → column pick → filter → table → pivot → save → export

---

## Phase 8b — Build verification

Before the demo app can run, the library itself must build cleanly.

```bash
# From repo root
pnpm install
pnpm --filter @pojagi/sanjaya-ui build
pnpm --filter @pojagi/demo-react dev
```

### 8b deliverables

- [ ] `pnpm install` resolves all workspace deps
- [ ] `@pojagi/sanjaya-ui` builds with zero errors (TS + Vite)
- [ ] Demo app loads in browser, connects to demo server

---

## Phase 8c — Report list sidebar (stretch)

Add a report list panel to the demo app:

1. Sidebar (MUI `Drawer`) listing saved reports via `client.listReports()`.
2. Click a report → loads it into `<ReportBuilder report={...} />`.
3. "New Report" button resets the builder.
4. Visual indicators for report status (draft, published, archived).

This panel is specific to the demo app. Production hosts will integrate
report listing into their own navigation.

### 8c deliverables

- [ ] Report list sidebar component
- [ ] Load / new report flow
- [ ] Status chip indicators (draft, published, archived)

---

## Integrating into a production host application

### Step 1: Install the library

```bash
npm install @pojagi/sanjaya-ui
# Peer deps — install if not already present:
npm install react react-dom @mui/material @emotion/react @emotion/styled \
  ag-grid-react ag-grid-community ag-grid-enterprise
```

### Step 2: Register AG Grid modules

In your application entry point (before any grid renders):

```ts
import { ModuleRegistry } from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
import { LicenseManager } from "ag-grid-enterprise";

ModuleRegistry.registerModules([AllEnterpriseModule]);
LicenseManager.setLicenseKey(process.env.AG_GRID_LICENSE_KEY!);
```

### Step 3: Implement `SanjayaClient`

Create a class or object that implements the `SanjayaClient` interface.
Use whatever HTTP library your app already uses:

```ts
import type { SanjayaClient } from "@pojagi/sanjaya-ui";

const client: SanjayaClient = {
  async listDatasets() {
    return myApiClient.get("/reporting/datasets/");
  },
  async getColumns(datasetKey) {
    return myApiClient.get(`/reporting/datasets/${datasetKey}/columns/`);
  },
  async tableQuery(datasetKey, body) {
    return myApiClient.post(`/reporting/datasets/${datasetKey}/table/`, body);
  },
  // ... remaining methods
};
```

Authentication, CSRF tokens, base URL configuration, error handling, and
caching are all the host's responsibility.

### Step 4: Wrap in providers

```tsx
import { SanjayaProvider, ReportBuilder } from "@pojagi/sanjaya-ui";

function ReportingPage() {
  return (
    <SanjayaProvider client={mySanjayaClient}>
      <ReportBuilder
        report={currentReport}
        onSaved={(report) => navigate(`/reports/${report.id}`)}
        onDeleted={() => navigate("/reports")}
      />
    </SanjayaProvider>
  );
}
```

The `SanjayaProvider` can be placed anywhere in the component tree — at
the route level, in a layout, or at the app root.

### Step 5: Theming

`@pojagi/sanjaya-ui` components use MUI's `sx` prop and standard MUI
components. They inherit the nearest `ThemeProvider`. No custom theme
tokens are required, but the host can override MUI's palette, typography,
spacing, etc. as usual.

AG Grid theming is separate — use AG Grid's `--ag-*` CSS custom
properties or provide a theme class. The `<DataGrid>` component accepts
standard `AgGridReact` props via spread.

---

## Upgrade path: auto-generated client types

For hosts that want **compile-time safety** against API drift, two
options exist:

### Option A — `openapi-typescript` + `openapi-fetch`

```bash
npx openapi-typescript api/tsp-output/@typespec/openapi3/openapi.yaml \
  -o src/generated/sanjaya-api.d.ts
```

Then use `openapi-fetch` for a type-safe client:

```ts
import createClient from "openapi-fetch";
import type { paths } from "./generated/sanjaya-api";

const api = createClient<paths>({ baseUrl: "/api/v1/reporting" });

const sanjayaClient: SanjayaClient = {
  async listDatasets() {
    const { data } = await api.GET("/datasets/");
    return data!;
  },
  // ...
};
```

### Option B — TypeSpec direct import

If the host's own API surface uses TypeSpec, import Sanjaya's models
directly:

```tsp
import "@pojagi/sanjaya/api/models/dynamic-reports.tsp";
```

This gives compile-time types without the OpenAPI intermediate step.

---

## Sequence diagram: full user flow

```
User               Demo App          SanjayaProvider     ReportBuilder        SanjayaClient         Backend
 │                    │                    │                   │                    │                   │
 │  open app          │                    │                   │                    │                   │
 │───────────────────>│                    │                   │                    │                   │
 │                    │ <SanjayaProvider>   │                   │                    │                   │
 │                    │───────────────────>│                   │                    │                   │
 │                    │                    │ <ReportBuilder>    │                    │                   │
 │                    │                    │──────────────────>│                    │                   │
 │                    │                    │                   │ listDatasets()      │                   │
 │                    │                    │                   │───────────────────>│  GET /datasets/   │
 │                    │                    │                   │                    │──────────────────>│
 │                    │                    │                   │                    │    [{key,label}]   │
 │                    │                    │                   │<───────────────────│<──────────────────│
 │                    │                    │                   │                    │                   │
 │  select dataset    │                    │                   │                    │                   │
 │───────────────────────────────────────────────────────────>│                    │                   │
 │                    │                    │                   │ getColumns(key)     │                   │
 │                    │                    │                   │───────────────────>│ GET /datasets/k/columns/
 │                    │                    │                   │                    │──────────────────>│
 │                    │                    │                   │                    │   [Column...]      │
 │                    │                    │                   │<───────────────────│<──────────────────│
 │                    │                    │                   │                    │                   │
 │  configure cols,   │                    │                   │                    │                   │
 │  filters, pivot    │                    │                   │                    │                   │
 │───────────────────────────────────────────────────────────>│                    │                   │
 │                    │                    │                   │ tableQuery(key,body)│                   │
 │                    │                    │                   │───────────────────>│ POST /datasets/k/table/
 │                    │                    │                   │                    │──────────────────>│
 │                    │                    │                   │                    │ {rowData,rowCount} │
 │                    │                    │                   │<───────────────────│<──────────────────│
 │                    │                    │                   │   render grid       │                   │
 │<──────────────────────────────────────────────────────────────────────────────────                  │
 │                    │                    │                   │                    │                   │
 │  click Save        │                    │                   │                    │                   │
 │───────────────────────────────────────────────────────────>│                    │                   │
 │                    │                    │                   │ createReport(body)  │                   │
 │                    │                    │                   │───────────────────>│ POST /reports/    │
 │                    │                    │                   │                    │──────────────────>│
 │                    │                    │                   │                    │ {id, title, ...}  │
 │                    │                    │                   │<───────────────────│<──────────────────│
 │                    │                    │                   │  onSaved(report)   │                   │
 │<──────────────────────────────────────────────────────────────────────────────────                  │
```

---

## Phasing summary

| Phase | Scope | Status |
|-------|-------|--------|
| 1–7 | Component library (`@pojagi/sanjaya-ui`) | ✅ Code complete (see [MVP plan](ui-mvp-plan.md)) |
| **8a** | Demo React app scaffold + fetch-based client | Not started |
| **8b** | Build verification (pnpm install + build) | Not started |
| **8c** | Report list sidebar in demo app (stretch) | Not started |

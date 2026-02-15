# Sanjaya — Vanilla TypeScript Demo

Minimal reference application that wires `@pojagi/sanjaya-ui` web components to
the Django demo server using plain TypeScript + Vite.

## Prerequisites

| Dependency | Version |
|---|---|
| Node.js | ≥ 18 |
| pnpm | ≥ 9 |
| Django demo server | running on `http://localhost:8000` |
| MSSQL (Docker) | for Northwind dataset |

### Start the backend

From the repo root:

```bash
# 1. Start the MSSQL container
docker compose -f docker-compose.mssql.yml up -d

# 2. Run the Django demo server
make demo-server
```

## Setup

```bash
# From the repo root — pnpm workspace handles everything
pnpm install
```

## Development

```bash
pnpm --filter @pojagi/demo-vanilla dev
```

Opens at **http://localhost:5173**.  Vite proxies nothing — the Django server's
CORS config allows `localhost:5173` and `localhost:5174`.

## Build

```bash
pnpm --filter @pojagi/demo-vanilla build
```

Output goes to `apps/demo-vanilla/dist/`.

## How it works

| File | Role |
|---|---|
| `index.html` | Vite entry point — sidebar layout with `<sj-report-builder>` and `<sj-data-grid>` |
| `src/client.ts` | `SanjayaDataClient` implementation using `fetch()` against the Django API |
| `src/main.ts` | Bootstrap — injects AG Grid, wires components, handles sidebar UX |
| `src/style.css` | Layout CSS + Sanjaya light theme import |

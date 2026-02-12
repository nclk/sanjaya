# Copilot Instructions — Sanjaya

## Project overview

Sanjaya is a pluggable dynamic reporting platform for Django.  It is organised
as a monorepo with three independently installable Python packages and a
TypeSpec API definition.

## Repository layout

```
packages/
  sanjaya-core/       # Shared types, enums, DataProvider ABC, MockDataProvider
  sanjaya/            # Django Ninja app (API, models, services, schemas)
  sanjaya-sqlalchemy/ # SQLAlchemy Core DataProvider implementation
api/                  # TypeSpec definitions → OpenAPI 3.0
```

## Technology stack

- **Python 3.12** — use `StrEnum`, `match`/`case`, modern type hints.
- **Pydantic v2** — all shared models. Use `model_validator`, `field_validator`,
  `model_dump()` (never `.dict()`).
- **Django ≥ 4.2** + **Django Ninja ≥ 1.0** — for the `sanjaya` app.
- **SQLAlchemy ≥ 2.0 Core** — no ORM. Use `sa.select()`, `sa.func`, column
  expressions.  The provider's `_column_lookup` is
  `dict[str, ColumnElement[Any]]`.
- **hatchling** — build backend for all three packages.
- **pytest** — test runner. Each package has its own `tests/` and `conftest.py`.
  Never run all packages with a single `pytest` invocation (fixture name
  collisions between packages).
- **uv** — package installer (`uv pip install -e "packages/foo[dev]"`).
- **TypeSpec 1.9** — `api/` directory, compiled with `pnpm build`.

## Architecture principles

- **`sanjaya-core` has zero framework dependencies.** It defines the
  `DataProvider` ABC and all Pydantic models. Any new shared type goes here.
- **`sanjaya` (Django app) never imports SQLAlchemy.** It talks to providers
  only through the `DataProvider` interface.
- **`sanjaya-sqlalchemy` depends only on `sanjaya-core` and `sqlalchemy`.**
  It never imports Django.
- **Python-as-config** — datasets are registered by importing a module that
  calls `ProviderRegistry().add(...)`.  Configured via `SANJAYA_PROVIDERS`
  in Django settings.
- **AG Grid SSRM** — the pivot endpoint speaks the AG Grid Server-Side Row
  Model wire format. Pivot translation lives in `sanjaya.services.pivot`.
- **Server-driven export** — CSV (streaming) and XLSX via `openpyxl`.

## Key patterns

### Filter model

`FilterGroup` and `FilterCondition` in `sanjaya_core.filters` use a
`model_validator(mode="before")` to alias the JSON key `"not"` to the Python
field `negate` (since `not` is a reserved word). `model_dump(by_alias=True)`
serialises it back as `"not"`.

### Provider interface

Every provider must implement `DataProvider` (in `sanjaya_core.provider`):
- `get_columns() → list[ColumnMeta]`
- `query(columns, filter_group, sort, limit, offset) → TabularResult`
- `aggregate(group_by, values, filter_group) → AggregateResult`

Properties: `key`, `label`, `description`, `capabilities`.

### Permissions model

- Django model `default_permissions = ()` — no auto-generated permissions.
- Custom permissions use `can_*` codename convention (e.g., `can_view_any`,
  `can_edit_any`).
- Report ownership: exactly one owner at a time, transferred via
  `transferOwnership` action.
- Shares grant `viewer` or `editor` roles (never `owner` — owner is implicit
  via `created_by`).

### Route ordering

In Django Ninja routers, literal paths (`/stats`) must be registered **before**
parameterised paths (`/{report_id}`) to avoid route shadowing.

## Coding conventions

- Use `from __future__ import annotations` in every Python file.
- Prefer `StrEnum` for enums, not plain `str` enums.
- Type hints on all public function signatures.
- No wildcard imports.
- Tests are plain pytest — use fixtures, not setUp/tearDown.
- Django tests need `DJANGO_SETTINGS_MODULE=tests.settings`.

## Running tests

```bash
pytest packages/sanjaya-core/
pytest packages/sanjaya-sqlalchemy/
DJANGO_SETTINGS_MODULE=tests.settings pytest packages/sanjaya/
```

## Building the TypeSpec

```bash
cd api && pnpm install && pnpm build
```

Outputs OpenAPI 3.0 YAML to `api/tsp-output/@typespec/openapi3/openapi.yaml`.

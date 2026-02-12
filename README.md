# Sanjaya

A pluggable dynamic reporting platform for Django.  Sanjaya lets front-end
clients discover datasets, apply filters, request AG Grid Server-Side Row
Model (SSRM) pivot responses, and export data — all driven by Python-as-config
dataset definitions and a provider interface that decouples the API layer from
any particular database technology.

## Packages

The project is split into three independently installable packages:

| Package | Description |
|---------|-------------|
| **[sanjaya-core](packages/sanjaya-core/)** | Shared Pydantic types, enums, filter models, the `DataProvider` ABC, and a `MockDataProvider` for testing. No Django or SQLAlchemy dependency. |
| **[sanjaya](packages/sanjaya/)** | Django Ninja app — dataset discovery, filtered previews, AG Grid pivot, CSV/XLSX export, saved-report CRUD with per-user/group sharing and ownership transfer. |
| **[sanjaya-sqlalchemy](packages/sanjaya-sqlalchemy/)** | `DataProvider` implementation backed by SQLAlchemy Core (no ORM). Compiles filter trees to SQL, supports flat queries, grouped aggregation, and pivot via `CASE WHEN`. |

## Quick start

```bash
# install everything for local development
uv pip install -e "packages/sanjaya-core[dev]" \
               -e "packages/sanjaya[dev]" \
               -e "packages/sanjaya-sqlalchemy[dev]"
```

### 1. Define a dataset

```python
# myproject/reporting/datasets.py
from sqlalchemy import MetaData, create_engine
from sanjaya_core.enums import ColumnType, AggFunc
from sanjaya_core.types import (
    ColumnMeta, ColumnPivotOptions, PivotAggOption, DatasetCapabilities,
)
from sanjaya_sqlalchemy import SQLAlchemyProvider
from sanjaya.registry import ProviderRegistry

engine = create_engine("postgresql://...")
metadata = MetaData()
metadata.reflect(bind=engine)

ProviderRegistry().add(
    SQLAlchemyProvider(
        key="trade_activity",
        label="Trade Activity",
        engine=engine,
        selectable=metadata.tables["trade_activity"],
        columns=[
            ColumnMeta(name="desk", label="Desk", type=ColumnType.STRING,
                       pivot=ColumnPivotOptions(role="dimension")),
            ColumnMeta(name="amount", label="Amount", type=ColumnType.CURRENCY,
                       pivot=ColumnPivotOptions(
                           role="measure",
                           allowed_aggs=[PivotAggOption(agg=AggFunc.SUM, label="Sum")],
                       )),
        ],
        capabilities=DatasetCapabilities(pivot=True),
    )
)
```

### 2. Wire it up in Django

```python
# settings.py
INSTALLED_APPS = [..., "sanjaya"]
SANJAYA_PROVIDERS = ["myproject.reporting.datasets"]
```

```python
# urls.py
from ninja import NinjaAPI
from sanjaya.api import router as reporting_router

api = NinjaAPI()
api.add_router("v1/reporting", reporting_router)
```

### 3. Use the API

```
GET  /v1/reporting/datasets/
GET  /v1/reporting/datasets/{key}/columns/
POST /v1/reporting/datasets/{key}/query/
POST /v1/reporting/datasets/{key}/aggregate/
POST /v1/reporting/datasets/{key}/pivot/
POST /v1/reporting/datasets/{key}/export/
POST /v1/reporting/reports/
GET  /v1/reporting/reports/{id}/
...
```

## TypeSpec

The `api/` directory contains a [TypeSpec](https://typespec.io/) definition of
the API surface.  It is the design-time spec that the Python implementation
follows.

```bash
cd api && pnpm install && pnpm build
# OpenAPI 3.0 spec → api/tsp-output/@typespec/openapi3/openapi.yaml
```

## Running tests

Each package has its own test suite.  Run them individually:

```bash
pytest packages/sanjaya-core/
pytest packages/sanjaya-sqlalchemy/
DJANGO_SETTINGS_MODULE=tests.settings pytest packages/sanjaya/
```

## Requirements

- Python ≥ 3.12
- Django ≥ 4.2 (for the `sanjaya` app)
- SQLAlchemy ≥ 2.0 (for `sanjaya-sqlalchemy`)

## License

[MIT](LICENSE)

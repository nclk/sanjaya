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
| **[sanjaya-ninja](packages/sanjaya-ninja/)** | Django Ninja app — dataset discovery, filtered previews, AG Grid pivot, CSV/XLSX export, saved-report CRUD with per-user/group sharing and ownership transfer. |
| **[sanjaya-sqlalchemy](packages/sanjaya-sqlalchemy/)** | `DataProvider` implementation backed by SQLAlchemy Core (no ORM). Compiles filter trees to SQL, supports flat queries, grouped aggregation, and pivot via `CASE WHEN`. |

## Quick start

```bash
# install all packages and dev dependencies
uv sync
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
from sanjaya_ninja.registry import ProviderRegistry

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
INSTALLED_APPS = [..., "sanjaya_ninja"]
SANJAYA_PROVIDERS = ["myproject.reporting.datasets"]
```

```python
# urls.py
from ninja import NinjaAPI
from sanjaya_ninja.api import router as reporting_router

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
DJANGO_SETTINGS_MODULE=tests.settings pytest packages/sanjaya-ninja/
```

## Requirements

- Python ≥ 3.12
- Django ≥ 4.2 (for `sanjaya-ninja`)
- SQLAlchemy ≥ 2.0 (for `sanjaya-sqlalchemy`)

## Building & publishing

All build and publish tasks are driven by the root [Makefile](Makefile) using
`uv run` (for Python packages) and `pnpm`/`npm` (for the TypeSpec package).

### Prerequisites

Build and publish tools are declared in the root `pyproject.toml`
`[dependency-groups]` and installed automatically by:

```bash
uv sync
```

For the TypeSpec package, ensure `pnpm` and `npm` are available.

### Python packages

```bash
# Build a single package (sdist + wheel)
make build PKG=sanjaya-core

# Build all three packages in dependency order
make build-all

# Publish a single package to PyPI
make publish PKG=sanjaya-core

# Publish all three
make publish-all
```

### Snapshot (dev) releases

Snapshot builds use [PEP 440](https://peps.python.org/pep-0440/) `.devN`
versions (e.g. `0.1.0.dev1770940497`).  These are **excluded by default** from
`pip install`, so they are safe to publish to regular PyPI — they will never
leak to production consumers.

```bash
# Build a snapshot for one package
make snapshot PKG=sanjaya-core

# Build snapshots for all packages
make snapshot-all

# Then publish as usual
make publish PKG=sanjaya-core
```

The snapshot target temporarily stamps the version in `pyproject.toml` and
`__init__.py`, builds the wheel/sdist, then reverts the files so the snapshot
version is never committed.

**Installing snapshots:**

```bash
# Latest dev build
pip install --pre sanjaya-core

# Exact version
pip install sanjaya-core==0.1.0.dev1770940497
```

### TypeSpec package

The `sanjaya-api` npm package ships the TypeSpec source files so consumers can
import models and routes into their own TypeSpec projects.

```bash
# Compile TypeSpec → OpenAPI
make tsp-build

# Publish a stable release to npm
make tsp-publish

# Publish a dev-tagged snapshot to npm
make tsp-snapshot
```

**Consuming the TypeSpec package:**

```bash
npm install sanjaya-api          # stable
npm install sanjaya-api@dev      # latest snapshot
```

```typespec
import "sanjaya-api";
import "sanjaya-api/models/dynamic-reports.tsp";
```

### PyPI credentials

Create per-project API tokens at [pypi.org](https://pypi.org/manage/account/token/)
and configure `~/.pypirc`:

```ini
[pypi]
username = __token__
password = pypi-AgEI...
```

Any team member with a token can cut and publish a snapshot from their machine.

## License

[MIT](LICENSE)

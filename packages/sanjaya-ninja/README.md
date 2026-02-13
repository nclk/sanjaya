# sanjaya-ninja

Django Ninja app for dynamic reporting with pluggable data providers.

Mount this app in your Django project to get a full reporting API — dataset
discovery, filtered previews, AG Grid pivot, CSV/XLSX export, and saved
report management with sharing.

## Installation

```bash
uv pip install -e "packages/sanjaya-ninja[dev]"
```

## Quick start

```python
# settings.py
INSTALLED_APPS = [
    ...,
    "sanjaya_ninja",
]

SANJAYA_PROVIDERS = [
    "myproject.reporting.datasets",
]
```

```python
# urls.py / api.py
from ninja import NinjaAPI
from sanjaya_ninja.api import router as reporting_router

api = NinjaAPI()
api.add_router("v1/reporting", reporting_router)
```

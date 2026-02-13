# sanjaya-django

Django Ninja app for dynamic reporting with pluggable data providers.

Mount this app in your Django project to get a full reporting API — dataset
discovery, filtered previews, AG Grid pivot, CSV/XLSX export, and saved
report management with sharing.

## Installation

```bash
uv pip install -e "packages/sanjaya-django[dev]"
```

## Quick start

```python
# settings.py
INSTALLED_APPS = [
    ...,
    "sanjaya_django",
]

SANJAYA_PROVIDERS = [
    "myproject.reporting.datasets",
]
```

```python
# urls.py / api.py
from ninja import NinjaAPI
from sanjaya_django.api import router as reporting_router

api = NinjaAPI()
api.add_router("v1/reporting", reporting_router)
```

### Trailing-slash tolerance

By default Django redirects requests without a trailing slash (e.g.
`POST /v1/reporting/reports`) with a `301`, which drops the request body
for non-GET methods.  To allow clients to call your API with **or**
without a trailing slash, add the provided middleware near the top of
your `MIDDLEWARE` list:

```python
# settings.py
MIDDLEWARE = [
    "sanjaya_django.middleware.TrailingSlashMiddleware",
    # …other middleware…
]
```

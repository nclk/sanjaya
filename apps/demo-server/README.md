# Sanjaya Demo Server

A runnable Django project that hosts the `sanjaya-django` app with a
Northwind-style relational dataset in MSSQL.

## Prerequisites

- Docker (for the MSSQL container)
- ODBC Driver 18 for SQL Server (system-level install)
- uv (Python package manager)

## Quick start

From the **repository root**:

```bash
# 1. Start MSSQL container and create the test database
make mssql-up

# 2. Seed the Northwind dataset (~3 000 rows across 4 tables)
make demo-seed

# 3. Run Django migrations (creates SQLite DB for reports/shares/favorites)
make demo-migrate

# 4. (Optional) Create a superuser for the Django admin
cd apps/demo-server && uv run python manage.py createsuperuser

# 5. Start the dev server
make demo-server
```

The API is live at **http://localhost:8000/api/v1/reporting/**.

## Dataset

The `order_details` dataset joins four tables from a Northwind-style
schema:

| Table | Rows | Description |
|-------|------|-------------|
| `customers` | ~90 | Company, contact, city, country |
| `products` | ~77 | Name, category, unit price, stock |
| `orders` | ~830 | Customer, date, ship country, freight |
| `order_details` | ~2 000 | Order line items: product, qty, price, discount |

The provider exposes a single flat view of order details joined through
orders → customers and orders → products, with a computed `line_total`
column.

## API endpoints

Once running, try:

```bash
# List datasets
curl http://localhost:8000/api/v1/reporting/datasets/

# Get columns for the order_details dataset
curl http://localhost:8000/api/v1/reporting/datasets/order_details/columns/

# Query table data
curl -X POST http://localhost:8000/api/v1/reporting/datasets/order_details/table/ \
  -H "Content-Type: application/json" \
  -d '{"startRow": 0, "endRow": 10}'

# Pivot query
curl -X POST http://localhost:8000/api/v1/reporting/datasets/order_details/pivot/ \
  -H "Content-Type: application/json" \
  -d '{
    "startRow": 0,
    "endRow": 100,
    "rowGroupCols": [{"id": "category", "displayName": "Category", "field": "category"}],
    "valueCols": [{"id": "line_total", "displayName": "Line Total", "field": "line_total", "aggFunc": "sum"}],
    "pivotCols": [{"id": "ship_country", "displayName": "Ship Country", "field": "ship_country"}],
    "pivotMode": true,
    "groupKeys": []
  }'
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SANJAYA_MSSQL_URL` | `mssql+pyodbc://sa:Sanjaya_Test1@localhost:1433/sanjaya_test?...` | SQLAlchemy URL for the Northwind data |
| `DJANGO_SECRET_KEY` | `demo-insecure-key-not-for-production` | Django secret key |
| `DJANGO_DEBUG` | `1` | Set to `0` for production-like behaviour |

## Stopping

```bash
# Stop the MSSQL container
make mssql-down
```

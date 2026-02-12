# sanjaya-core

Shared types, enums, and data-provider interface for the Sanjaya dynamic reporting platform.

This package has **no Django or SQLAlchemy dependencies** — it defines the contract that all data providers implement and that the `sanjaya` Django app consumes.

## Installation

```bash
uv pip install -e "packages/sanjaya-core[dev]"
```

## What's inside

- **Enums** — `ColumnType`, `FilterOperator`, `AggFunc`, etc.
- **Pydantic models** — `ColumnMeta`, `FilterGroup`, `TabularResult`, `AggregateResult`, etc.
- **`DataProvider` ABC** — the interface every provider package implements.
- **`MockDataProvider`** — an in-memory implementation for testing.

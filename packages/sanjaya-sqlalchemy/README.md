# sanjaya-sqlalchemy

SQLAlchemy Core data-provider implementation for the Sanjaya reporting platform.

Translates the `DataProvider` interface from `sanjaya-core` into SQL queries using SQLAlchemy Core expressions. No ORM required.

## Installation

```
pip install sanjaya-sqlalchemy
```

## Usage

```python
from sqlalchemy import MetaData, create_engine
from sanjaya_core.types import ColumnMeta, DatasetCapabilities
from sanjaya_core.enums import ColumnType
from sanjaya_sqlalchemy import SQLAlchemyProvider

engine = create_engine("postgresql://...")
metadata = MetaData()
metadata.reflect(bind=engine)

provider = SQLAlchemyProvider(
    key="trade_activity",
    label="Trade Activity",
    engine=engine,
    selectable=metadata.tables["trade_activity"],
    columns=[
        ColumnMeta(name="id", label="ID", type=ColumnType.NUMBER),
        ColumnMeta(name="desk", label="Desk", type=ColumnType.STRING),
        ColumnMeta(name="amount", label="Amount", type=ColumnType.CURRENCY),
    ],
    capabilities=DatasetCapabilities(pivot=True),
)
```

### Lazy engine creation

If creating the engine at module-load time is too expensive (e.g. the
connection pool takes a long time to initialise), pass a zero-argument
callable instead.  The engine will be created on the first query:

```python
from sqlalchemy import MetaData, create_engine
from sanjaya_sqlalchemy import SQLAlchemyProvider

# MetaData can still be built against a lightweight / temporary engine,
# or defined manually with sa.Table(...) / sa.Column(...).
metadata = MetaData()
trade_table = sa.Table(
    "trade_activity",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("desk", sa.String(50)),
    sa.Column("amount", sa.Float),
)

provider = SQLAlchemyProvider(
    key="trade_activity",
    label="Trade Activity",
    engine=lambda: create_engine("postgresql://..."),
    selectable=trade_table,
    columns=[...],
)
```

This pairs well with the `ProviderRegistry.add_lazy()` API in
`sanjaya-django` for fully deferred provider setup.
```

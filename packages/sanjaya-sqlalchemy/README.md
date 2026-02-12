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

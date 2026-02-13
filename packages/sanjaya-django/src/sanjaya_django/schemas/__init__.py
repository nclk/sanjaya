"""Shared schema utilities for the Sanjaya Django API."""

from __future__ import annotations

from ninja import Schema
from pydantic import ConfigDict
from pydantic.alias_generators import to_camel


class CamelSchema(Schema):
    """Base schema that serialises field names as camelCase on the wire.

    Python code continues to use snake_case attribute names; the camelCase
    aliases are used only for JSON parsing and serialisation, matching the
    TypeSpec/OpenAPI contract.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

"""Lightweight request context passed into provider methods.

This is intentionally thin — the host Django project owns authentication and
authorization.  ``RequestContext`` simply carries enough identity information
for providers that need to do row-level filtering or audit logging.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RequestContext(BaseModel):
    """Identity / permission snapshot for a single request."""

    user_id: str | None = None
    tenant_id: str | None = None
    permissions: list[str] = Field(default_factory=list)
    groups: list[str] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)

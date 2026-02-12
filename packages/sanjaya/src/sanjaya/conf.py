"""Settings helpers — read ``SANJAYA_*`` from Django settings with defaults."""

from __future__ import annotations

from typing import Any

from django.conf import settings


def get_providers_modules() -> list[str]:
    """Return the list of dotted module paths from ``SANJAYA_PROVIDERS``."""
    return getattr(settings, "SANJAYA_PROVIDERS", [])


def get_setting(name: str, default: Any = None) -> Any:
    """Read a ``SANJAYA_<NAME>`` setting."""
    return getattr(settings, f"SANJAYA_{name}", default)

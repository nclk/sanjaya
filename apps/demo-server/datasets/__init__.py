"""Dataset provider registration for the Northwind order details dataset.

This module is discovered automatically by sanjaya-django via the
``SANJAYA_PROVIDERS = ["datasets"]`` setting.  It defines a ``register()``
function that the :class:`ProviderRegistry` calls at startup.
"""

from __future__ import annotations

from sanjaya_django.registry import ProviderRegistry

from datasets.order_details import make_provider


def register(registry: ProviderRegistry) -> None:
    """Register all dataset providers."""
    registry.add_lazy(make_provider, key="order_details")

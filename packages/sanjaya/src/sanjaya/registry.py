"""Provider registry — maps dataset keys to :class:`DataProvider` instances.

The registry is a module-level singleton.  It is populated at startup by
:meth:`SanjayaConfig.ready` which imports each module listed in
``settings.SANJAYA_PROVIDERS`` and either calls ``register(registry)`` (if
the module defines one) or auto-collects module-level ``DataProvider``
instances.
"""

from __future__ import annotations

import importlib
import logging
from typing import Any, Callable

from sanjaya_core import DataProvider
from sanjaya_core.exceptions import DatasetNotFoundError

logger = logging.getLogger(__name__)


class ProviderRegistry:
    """Keyed collection of :class:`DataProvider` instances."""

    def __init__(self) -> None:
        self._providers: dict[str, DataProvider] = {}
        self._lazy: dict[str, Callable[..., DataProvider]] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def add(self, provider: DataProvider) -> None:
        """Register a provider instance by its ``key``."""
        if provider.key in self._providers:
            logger.warning("Overwriting provider %r", provider.key)
        self._providers[provider.key] = provider

    def add_lazy(
        self,
        factory: Callable[..., DataProvider],
        key: str | None = None,
    ) -> None:
        """Register a factory that will be called on first access.

        Parameters
        ----------
        factory:
            A callable that returns a :class:`DataProvider`.  It will receive
            no arguments (use closures / functools.partial to bind state).
        key:
            Explicit dataset key.  If *None*, the factory's ``__name__`` is
            used as a temporary key until the provider is materialised.
        """
        k = key or getattr(factory, "__name__", str(id(factory)))
        self._lazy[k] = factory

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    def get(self, dataset_key: str) -> DataProvider:
        """Return the provider for *dataset_key*, or raise."""
        if dataset_key in self._providers:
            return self._providers[dataset_key]

        # Try lazy resolution.
        if dataset_key in self._lazy:
            factory = self._lazy.pop(dataset_key)
            provider = factory()
            self._providers[provider.key] = provider
            return provider

        raise DatasetNotFoundError(dataset_key)

    def list_keys(self) -> list[str]:
        """Return all known dataset keys (eager + lazy)."""
        return sorted(set(self._providers) | set(self._lazy))

    def list_providers(self) -> list[DataProvider]:
        """Return all *eagerly-loaded* providers.

        Lazy providers are **not** materialised by this call.
        """
        return list(self._providers.values())

    def all_providers(self) -> list[DataProvider]:
        """Return all providers, materialising lazy ones."""
        for key in list(self._lazy):
            self.get(key)
        return list(self._providers.values())

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def discover_module(self, module_path: str) -> None:
        """Import *module_path* and register any providers found in it.

        If the module defines a ``register(registry)`` function it is called.
        Otherwise, all module-level attributes that are :class:`DataProvider`
        instances are auto-registered.
        """
        mod = importlib.import_module(module_path)

        register_fn = getattr(mod, "register", None)
        if callable(register_fn):
            register_fn(self)
            return

        for attr_name in dir(mod):
            attr = getattr(mod, attr_name)
            if isinstance(attr, DataProvider):
                self.add(attr)

    def clear(self) -> None:
        """Remove all registered providers (useful for tests)."""
        self._providers.clear()
        self._lazy.clear()


# Module-level singleton — imported by the app config and API routers.
registry = ProviderRegistry()

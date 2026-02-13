"""Django app configuration for Sanjaya."""

from __future__ import annotations

import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class SanjayaDjangoConfig(AppConfig):
    name = "sanjaya_django"
    verbose_name = "Sanjaya Dynamic Reporting"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from sanjaya_django.conf import get_providers_modules
        from sanjaya_django.registry import registry

        for module_path in get_providers_modules():
            try:
                registry.discover_module(module_path)
            except Exception:
                logger.exception(
                    "Failed to discover providers from %r", module_path
                )

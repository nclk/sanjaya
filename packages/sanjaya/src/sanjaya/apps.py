"""Django app configuration for Sanjaya."""

from __future__ import annotations

import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class SanjayaConfig(AppConfig):
    name = "sanjaya"
    verbose_name = "Sanjaya Dynamic Reporting"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from sanjaya.conf import get_providers_modules
        from sanjaya.registry import registry

        for module_path in get_providers_modules():
            try:
                registry.discover_module(module_path)
            except Exception:
                logger.exception(
                    "Failed to discover providers from %r", module_path
                )

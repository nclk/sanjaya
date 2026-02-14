"""URL configuration for the Sanjaya demo server."""

from __future__ import annotations

from ninja import NinjaAPI

from django.urls import path

from sanjaya_django.api import router as reporting_router

api = NinjaAPI(
    title="Sanjaya Demo API",
    version="1.0.0",
    urls_namespace="sanjaya-demo",
)
api.add_router("v1/reporting/", reporting_router)

urlpatterns = [
    path("api/", api.urls),
]

"""Django settings for the Sanjaya demo server.

Uses SQLite for Django's own models (reports, shares, favorites) and
MSSQL for the Northwind dataset via SQLAlchemy (not Django ORM).
"""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "demo-insecure-key-not-for-production",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = ["*"]

# ── Installed apps ────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "corsheaders",
    "sanjaya_django",
]

# ── Middleware ────────────────────────────────────────────────────
MIDDLEWARE = [
    "sanjaya_django.middleware.TrailingSlashMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "demo.middleware.AutoAuthMiddleware",
]

# ── CORS — allow the Vite dev servers (7c / 7d) ──────────────────
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
]

ROOT_URLCONF = "demo.urls"

# ── Database — SQLite for Django models ───────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Sanjaya provider discovery ────────────────────────────────────
SANJAYA_PROVIDERS = ["datasets"]

# ── MSSQL connection for the data provider ────────────────────────
MSSQL_URL = os.environ.get(
    "SANJAYA_MSSQL_URL",
    "mssql+pyodbc://sa:Sanjaya_Test1@localhost:1433/sanjaya_test"
    "?driver=ODBC+Driver+18+for+SQL+Server"
    "&TrustServerCertificate=yes&Encrypt=no",
)

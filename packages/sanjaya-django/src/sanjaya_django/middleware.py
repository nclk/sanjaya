"""Optional middleware for trailing-slash tolerance.

Django's ``APPEND_SLASH`` / ``CommonMiddleware`` combination redirects
requests that lack a trailing slash with a ``301 Moved Permanently``.
This works fine for ``GET`` requests, but most HTTP clients do **not**
follow redirects for ``POST``, ``PATCH``, ``PUT`` or ``DELETE`` — the
request body is silently dropped and the endpoint appears broken.

This module provides :class:`TrailingSlashMiddleware` which normalises
the request path **before** URL resolution so that both
``/reporting/reports`` and ``/reporting/reports/`` reach the same view,
regardless of the project's ``APPEND_SLASH`` setting.

Usage — add to the **top** of your ``MIDDLEWARE`` list::

    MIDDLEWARE = [
        "sanjaya_django.middleware.TrailingSlashMiddleware",
        # …other middleware…
    ]

When installed this middleware makes Django's ``APPEND_SLASH`` and
``CommonMiddleware`` irrelevant for the Sanjaya API routes — both
slashed and un-slashed paths will resolve identically.
"""

from __future__ import annotations

from django.http import HttpRequest, HttpResponse


class TrailingSlashMiddleware:
    """Ensure the request path always ends with ``/``.

    If the incoming ``PATH_INFO`` does not already end with a slash, one
    is appended in-place so that Django's URL resolver sees the
    canonical form.  This is a lightweight, zero-allocation operation
    for requests that already have the slash.
    """

    def __init__(self, get_response: object) -> None:
        self.get_response = get_response  # type: ignore[assignment]

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not request.path_info.endswith("/"):
            request.path_info += "/"
        return self.get_response(request)  # type: ignore[no-any-return]

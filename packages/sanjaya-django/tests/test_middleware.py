"""Tests for TrailingSlashMiddleware."""

from __future__ import annotations

import pytest
from django.http import HttpRequest, HttpResponse

from sanjaya_django.middleware import TrailingSlashMiddleware


def _make_request(path: str) -> HttpRequest:
    """Build a minimal HttpRequest with the given path."""
    request = HttpRequest()
    request.path = path
    request.path_info = path
    request.method = "POST"
    return request


class TestTrailingSlashMiddleware:
    def _get_middleware(self, *, captured: dict) -> TrailingSlashMiddleware:
        """Create middleware that captures the path it forwards."""

        def fake_get_response(request: HttpRequest) -> HttpResponse:
            captured["path_info"] = request.path_info
            return HttpResponse(status=200)

        return TrailingSlashMiddleware(fake_get_response)

    def test_adds_slash_when_missing(self):
        captured: dict = {}
        mw = self._get_middleware(captured=captured)
        mw(_make_request("/reporting/reports"))
        assert captured["path_info"] == "/reporting/reports/"

    def test_preserves_existing_slash(self):
        captured: dict = {}
        mw = self._get_middleware(captured=captured)
        mw(_make_request("/reporting/reports/"))
        assert captured["path_info"] == "/reporting/reports/"

    def test_root_path(self):
        captured: dict = {}
        mw = self._get_middleware(captured=captured)
        mw(_make_request("/"))
        assert captured["path_info"] == "/"

    def test_nested_path_without_slash(self):
        captured: dict = {}
        mw = self._get_middleware(captured=captured)
        mw(_make_request("/v1/reporting/datasets/trades/preview"))
        assert captured["path_info"] == "/v1/reporting/datasets/trades/preview/"

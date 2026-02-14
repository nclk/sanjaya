"""Demo-only middleware for auto-authentication.

In DEBUG mode, every request is automatically authenticated as the first
superuser. This avoids the need for session/cookie management in the
frontend demo apps (Phases 7c / 7d) while still exercising the real
auth-gated API code paths in sanjaya-django.

**Never use this in production.**
"""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpRequest, HttpResponse


class AutoAuthMiddleware:
    """Authenticate every request as the first superuser when DEBUG=True."""

    def __init__(self, get_response: object) -> None:
        self.get_response = get_response  # type: ignore[assignment]
        self._user = None

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if settings.DEBUG and not getattr(request, "user", None):
            request.user = self._get_superuser()  # type: ignore[assignment]
        elif settings.DEBUG and not request.user.is_authenticated:
            request.user = self._get_superuser()  # type: ignore[assignment]
        return self.get_response(request)  # type: ignore[no-any-return]

    def _get_superuser(self):
        if self._user is None:
            User = get_user_model()
            self._user = User.objects.filter(is_superuser=True).first()
        return self._user

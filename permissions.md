# How authentication & authorization reach Sanjaya (EWI)
Sanjaya is **not** called as a separate downstream service in this repo. It's an **in-process Django app** that's mounted into the main EWI Django Ninja API. That means authentication and authorization are not "forwarded" via another token/header; they arrive as normal Django request context via request.user (plus Django permissions/groups).
> Date: 2026-02-12
## 1) Where Sanjaya is mounted
Incoming requests enter the main Django project and route into a shared Ninja API instance.
backend/django_ewi/django_ewi/urls.py
mounts the Ninja API at path ("api/", api.urls)`
mounts ADFS auth endpoints at path("oauth2/", include("django_auth_adfs.urls"))" mounts reporting routes:
*api.add router("v1/reporting", reporting router)`
applets/sanjaya/django/sanjaya/api.py
router.add router("", reports router)` router, add router("", datasets router)
So Sanjaya endpoints are served under:
- `/api/v1/reporting/...`
## 2) Authentication: how request.user gets populated
### A) Ninja uses Django session authentication
backend/django_ewi/django_ewi/main.py
ру
api = NinjaAPI (title="EWI API", auth-SessionAuth(csrf-not settings.DEBUG))
Ninja's SessionAuth expects the client (usually a browser) to present Django **session cookies** (and CSRF for unsafe methods when not in debug). ### B) Django middleware sets request.user
`backend/django ewi/django ewi/settings/base.py
The request pipeline includes:
'django.contrib.sessions.middleware.SessionMiddleware
'django.contrib.auth.middleware. AuthenticationMiddleware
These read the session and set request.user.
### C) How the session is created (Azure AD via django_auth_adfs`)
This repo uses 'django auth adfs with an **authorization code** flow backend.
- `backend/django_ewi/django_ewi/settings/base.py"
I
ᎠᎩ
AUTHENTICATION_BACKENDS =
(
"django.contrib.auth.backends.ModelBackend",
"django auth adfs.backend.AdfsAuthCodeBackend",
)

LOGIN URL = django auth adfs; login
backend/django_ewi/django_ewi/urls.py"
py
path("oauth2/", include("django auth adfs.urls"))
Typical flow:
1. User triggers login (redirect to Azure/ADFS via `django_auth_adfs`).
2. ADFS authenticates and returns an auth code.
3. Django exchanges the code for tokens, creates/updates the local user, and logs them in.
4. Django returns a **session cookie**.
5. Subsequent /api/... calls include the cookie; SessionAuth+ Django auth middleware sets request.user`.
### D) Group mirroring drives authorization
-backend/django_ewi/django_ewi/settings/base.py (AUTH_ADFS)
Key settings:
GROUPS CLAIM =
- MIRROR GROUPS
=
"groups" True
So group membership from the ID token is mirrored into Django `Group records.
### E) Local/dev override: force user or impersonate
-backend/django ewi/accounts/middleware.py (BypassLocalLogin`)
In DEBUG only:
If not authenticated and `TEMP_LOCAL_USER is set, it forces request.user to that user. If header `x-impersonate is set, it swaps to that user (and stores request.original_user`).
This is helpful for development but can make it look like auth "just shows up" without a real login. ## 3) Authorization inside Sanjaya
Sanjaya endpoints authorize using a combination of:
request.user.is authenticated
- Django permissions (request.user.has perm("sanjaya.<codename>"))
- Django groups (request.user.groups)
- Sanjaya share models (user shares and group shares)
### A) Basic auth requirement (datasets)
- applets/sanjaya/django/sanjaya/datasets_api.py
ру
def _require auth (user):
return (
user is not None
and not isinstance(user, AnonymousUser)
and user.is authenticated
)

Endpoints like "GET /datasets` and `GET /datasets/{dataset_key)/columns return 401 if the user is anonymous. ### B) Global "admin-ish" permissions (reports)
applets/sanjaya/django/sanjaya/reports_api.py`
py
def _has_reporting perm(user, codename: str) -> bool:
return bool (user. is superuser) or user.has perm(f"sanjaya.{codename}")
This powers global permission helpers such as:
can view any
can edit any
can publish any
can destroy any
can manage shares any
can transfer ownership any
### C) Per-report permission resolution
Also in `reports_api.py`, the effective per-report permission is computed as:
1. Owner if `report.created by id
==
user.id
2. Otherwise, if user has global `can view any, they can see it (as viewer) 3. Otherwise, check explicit shares:
`DynamicReportUserShare
DynamicReportGroupShare
(direct user share)
for any of the user's `user.groups
Permissions are normalized to one of: `viewer`, `editor`,
## 4) what is actually "passed down to Sanjaya"
Because Sanjaya is in-process:
owner.
**Authentication passed down:** request.user` (Django user populated by session auth). **Authorization passed down:** Django perms/groups and (for reports) Sanjaya share model lookups.
Not passed down as:
-
a bearer token forwarded to a downstream Sanjaya service
service-to-service auth headers
a separate "auth context" object
## 5) Common failure modes / edge cases
**Missing cookies / credentialed requests:**
-
If the frontend doesn't send cookies (credentials: 'include' in fetch, proper CORS, etc.), the backend will see an anonymous user → Sanjaya returns `401`.
→>>>
**CSRF failures on unsafe methods:**
SessionAuth(csrf-not settings. DEBUG) means CSRF may be enforced outside debug.
**Debug-only user override:**
TEMP_LOCAL_USER` and `x-impersonate can override the effective identity.
If you did intend "Sanjaya" to mean an external service (instead of the embedded app), search for outbound HTTP calls
to a Sanjaya base URL in the repo; from the routing and code here, Sanjaya appears embedded and authenticated via Django sessions.
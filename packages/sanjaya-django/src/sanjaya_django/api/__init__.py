"""Root router — composes all sub-routers into a single mountable router.

Usage in the host project::

    from ninja import NinjaAPI
    from sanjaya_django.api import router as reporting_router

    api = NinjaAPI()
    api.add_router("v1/reporting", reporting_router)
"""

from ninja import Router

from sanjaya_django.api.datasets import router as datasets_router
from sanjaya_django.api.export import router as export_router
from sanjaya_django.api.pivot import router as pivot_router
from sanjaya_django.api.reports import router as reports_router
from sanjaya_django.api.table import router as table_router

router = Router(by_alias=True)

router.add_router("/datasets", datasets_router)
router.add_router("/datasets", table_router)    # /datasets/{key}/table
router.add_router("/datasets", pivot_router)     # /datasets/{key}/pivot
router.add_router("/datasets", export_router)    # /datasets/{key}/export
router.add_router("/reports", reports_router)

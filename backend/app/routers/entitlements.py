"""Entitlement management endpoints (subscription data)."""

from sqlalchemy.orm import selectinload

from ..models import AccountEntitlement
from ..schemas import EntitlementCreate, EntitlementUpdate, EntitlementRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/entitlements",
    tag="Entitlements",
    model_class=AccountEntitlement,
    create_schema=EntitlementCreate,
    update_schema=EntitlementUpdate,
    read_schema=EntitlementRead,
    entity_name="entitlement",
    list_eager_options=(selectinload(AccountEntitlement.catalog_product),),
)

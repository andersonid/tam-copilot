"""Contact management endpoints (customer team + Red Hat team)."""

from ..models import AccountContact
from ..schemas import ContactCreate, ContactUpdate, ContactRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/contacts",
    tag="Contacts",
    model_class=AccountContact,
    create_schema=ContactCreate,
    update_schema=ContactUpdate,
    read_schema=ContactRead,
    entity_name="contact",
)

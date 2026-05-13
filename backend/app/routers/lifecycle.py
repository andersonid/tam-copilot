"""Product lifecycle endpoints (support phases and EOL dates)."""

from ..models import ProductLifecycle
from ..schemas import LifecycleCreate, LifecycleUpdate, LifecycleRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/lifecycle",
    tag="Product Lifecycle",
    model_class=ProductLifecycle,
    create_schema=LifecycleCreate,
    update_schema=LifecycleUpdate,
    read_schema=LifecycleRead,
    entity_name="lifecycle entry",
)

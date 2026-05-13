"""Engagement tracking endpoints (quarterly per customer area)."""

from ..models import Engagement
from ..schemas import EngagementCreate, EngagementUpdate, EngagementRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/engagements",
    tag="Engagements",
    model_class=Engagement,
    create_schema=EngagementCreate,
    update_schema=EngagementUpdate,
    read_schema=EngagementRead,
    entity_name="engagement",
)

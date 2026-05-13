"""Action plan management endpoints."""

from ..models import ActionPlan
from ..schemas import ActionPlanCreate, ActionPlanUpdate, ActionPlanRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/action-plans",
    tag="Action Plans",
    model_class=ActionPlan,
    create_schema=ActionPlanCreate,
    update_schema=ActionPlanUpdate,
    read_schema=ActionPlanRead,
    entity_name="action plan",
    default_order=ActionPlan.sort_order,
)

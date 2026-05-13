"""Risk register endpoints."""

from ..models import Risk
from ..schemas import RiskCreate, RiskUpdate, RiskRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/risks",
    tag="Risks",
    model_class=Risk,
    create_schema=RiskCreate,
    update_schema=RiskUpdate,
    read_schema=RiskRead,
    entity_name="risk",
)

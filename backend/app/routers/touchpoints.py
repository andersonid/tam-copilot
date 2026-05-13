"""Touchpoint (interaction log) endpoints."""

from ..models import Touchpoint
from ..schemas import TouchpointCreate, TouchpointUpdate, TouchpointRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/touchpoints",
    tag="Touchpoints",
    model_class=Touchpoint,
    create_schema=TouchpointCreate,
    update_schema=TouchpointUpdate,
    read_schema=TouchpointRead,
    entity_name="touchpoint",
    default_order=Touchpoint.touchpoint_date.desc(),
)

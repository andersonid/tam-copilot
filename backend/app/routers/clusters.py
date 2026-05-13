"""Cluster management endpoints (OCM telemetry data)."""

from ..models import AccountCluster
from ..schemas import ClusterCreate, ClusterUpdate, ClusterRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/clusters",
    tag="Clusters",
    model_class=AccountCluster,
    create_schema=ClusterCreate,
    update_schema=ClusterUpdate,
    read_schema=ClusterRead,
    entity_name="cluster",
)

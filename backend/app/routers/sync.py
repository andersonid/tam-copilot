"""Sync endpoints: pull live data from Red Hat APIs into local cache.

Each endpoint triggers an on-demand synchronization for a specific
data domain (cases, clusters, entitlements, contacts, lifecycle).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..access import ensure_account_access
from ..auth import get_current_user
from ..database import get_db
from ..models import Account, AdminUser
from ..services.sync import SyncService

logger = logging.getLogger("tam_copilot.routers.sync")

router = APIRouter(prefix="/v1/accounts/{account_id}/sync", tags=["Sync"])


def _get_sync_service() -> SyncService:
    """Lazy-load the sync service from app state."""
    from ..main import _sync_service
    if _sync_service is None:
        raise HTTPException(503, "Sync service not configured — set HYDRA_OFFLINE_TOKEN")
    return _sync_service


def _viewer_block(user: AdminUser) -> None:
    if user.role == "viewer":
        raise HTTPException(403, "Perfil somente leitura")


async def _get_account(account_id: int, db: AsyncSession, user: AdminUser) -> Account:
    await ensure_account_access(db, user, account_id)
    account = await db.scalar(select(Account).where(Account.id == account_id))
    if not account:
        raise HTTPException(404, f"Account {account_id} not found")
    return account


@router.post(
    "/entitlements",
    summary="Sync entitlements from Hydra",
    description="Pulls subscription entitlements for the account via Hydra API.",
)
async def sync_entitlements(
    account_id: int,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    svc = _get_sync_service()
    account = await _get_account(account_id, db, user)
    count = await svc.sync_entitlements(db, account)
    return {"synced": count, "domain": "entitlements", "account_id": account_id}


@router.post(
    "/contacts",
    summary="Sync contacts from Hydra",
    description="Pulls customer contacts for the account via Hydra API.",
)
async def sync_contacts(
    account_id: int,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    svc = _get_sync_service()
    account = await _get_account(account_id, db, user)
    count = await svc.sync_contacts(db, account)
    return {"synced": count, "domain": "contacts", "account_id": account_id}


@router.post(
    "/clusters",
    summary="Sync clusters from OCM",
    description="Pulls OpenShift cluster telemetry for the account via OCM API.",
)
async def sync_clusters(
    account_id: int,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    svc = _get_sync_service()
    account = await _get_account(account_id, db, user)
    count = await svc.sync_clusters(db, account)
    return {"synced": count, "domain": "clusters", "account_id": account_id}


@router.post(
    "/lifecycle",
    summary="Sync product lifecycle data",
    description="Pulls product lifecycle phases from the public Red Hat Lifecycle API.",
)
async def sync_lifecycle(
    account_id: int,
    products: list[str] = Query(default=None, description="Product names to sync"),
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    svc = _get_sync_service()
    account = await _get_account(account_id, db, user)
    count = await svc.sync_lifecycle(db, account, product_names=products)
    return {"synced": count, "domain": "lifecycle", "account_id": account_id}


@router.post(
    "/all",
    summary="Full sync for account",
    description="Runs all available sync operations for the account.",
)
async def sync_all(
    account_id: int,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    svc = _get_sync_service()
    account = await _get_account(account_id, db, user)
    results = await svc.sync_all(db, account)
    return {"account_id": account_id, "results": results}

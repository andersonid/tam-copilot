"""Account management endpoints.

Provides CRUD for locally managed accounts and a Hydra-backed
search endpoint that lets users find Red Hat customer accounts
by name or account number before importing them.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Account, AdminUser
from ..schemas import AccountCreate, AccountUpdate, AccountRead, AccountListRead

logger = logging.getLogger("tam_copilot.accounts")

router = APIRouter(prefix="/accounts", tags=["Accounts"])


# ---------------------------------------------------------------------------
# Hydra account search (live API proxy)
# ---------------------------------------------------------------------------

class HydraAccountResult(BaseModel):
    """Simplified representation of a Hydra account search result."""
    account_number: str
    name: str
    # Additional fields when available from Hydra response
    country: str | None = None
    tam_name: str | None = None
    support_level: str | None = None
    already_imported: bool = False


def _get_hydra_client():
    """Retrieve the initialised HydraClient from app startup."""
    from ..main import _sync_service
    if _sync_service is None or _sync_service.hydra is None:
        raise HTTPException(503, "Hydra integration not configured — set HYDRA_OFFLINE_TOKEN")
    return _sync_service.hydra


def _parse_hydra_account(raw: dict) -> dict[str, Any]:
    """Extract relevant fields from a Hydra account JSON blob."""
    return {
        "account_number": str(raw.get("accountNumber", raw.get("account_number", ""))),
        "name": raw.get("name", raw.get("company", "")),
        "country": raw.get("country", None),
        "tam_name": raw.get("tamName", raw.get("tam_name", None)),
        "support_level": raw.get("supportLevel", raw.get("support_level", None)),
    }


@router.get(
    "/search-hydra",
    response_model=list[HydraAccountResult],
    summary="Search Red Hat accounts via Hydra API",
    description=(
        "Proxies a search to the Hydra Support API so the user can find "
        "customer accounts by name or number. Results include whether the "
        "account was already imported locally."
    ),
)
async def search_hydra_accounts(
    q: str = Query(..., min_length=2, description="Account name or number"),
    db: AsyncSession = Depends(get_db),
):
    hydra = _get_hydra_client()

    # Try direct lookup when query looks like an account number
    results: list[dict[str, Any]] = []
    if q.isdigit():
        direct = await hydra.get_account(q)
        if isinstance(direct, dict) and not direct.get("error"):
            results = [_parse_hydra_account(direct)]
    if not results:
        raw_list = await hydra.search_accounts(q, rows=15)
        results = [_parse_hydra_account(r) for r in raw_list]

    if not results:
        return []

    # Mark accounts already imported locally
    numbers = [r["account_number"] for r in results if r["account_number"]]
    existing = set()
    if numbers:
        rows = await db.execute(
            select(Account.account_number).where(Account.account_number.in_(numbers))
        )
        existing = {r[0] for r in rows.fetchall()}

    return [
        HydraAccountResult(**r, already_imported=r["account_number"] in existing)
        for r in results
        if r["account_number"]
    ]


@router.get(
    "",
    response_model=list[AccountListRead],
    summary="List accounts",
    description="Returns all accounts. Filter by TAM user with tam_user_id param.",
)
async def list_accounts(
    tam_user_id: int | None = Query(None, description="Filter by TAM owner"),
    is_active: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Account).order_by(Account.name)
    if tam_user_id is not None:
        stmt = stmt.where(Account.tam_user_id == tam_user_id)
    if is_active is not None:
        stmt = stmt.where(Account.is_active == is_active)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=AccountRead,
    status_code=201,
    summary="Create account",
    description="Register a new customer account.",
)
async def create_account(body: AccountCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(
        select(Account).where(Account.account_number == body.account_number)
    )
    if existing:
        raise HTTPException(409, f"Account {body.account_number} already exists")
    account = Account(**body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    logger.info("account.created | id=%d number=%s", account.id, account.account_number)
    return account


@router.get(
    "/{account_id}",
    response_model=AccountRead,
    summary="Get account details",
)
async def get_account(account_id: int, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    return account


@router.patch(
    "/{account_id}",
    response_model=AccountRead,
    summary="Update account",
    description="Partial update — only provided fields are changed.",
)
async def update_account(
    account_id: int, body: AccountUpdate, db: AsyncSession = Depends(get_db),
):
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete(
    "/{account_id}",
    status_code=204,
    summary="Delete account",
    description="Permanently removes the account and all associated data.",
)
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    await db.delete(account)
    await db.commit()

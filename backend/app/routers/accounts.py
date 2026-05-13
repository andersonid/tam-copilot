"""Account management endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Account, AdminUser
from ..schemas import AccountCreate, AccountUpdate, AccountRead, AccountListRead

logger = logging.getLogger("tam_copilot.accounts")

router = APIRouter(prefix="/accounts", tags=["Accounts"])


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

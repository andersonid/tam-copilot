"""Account access control helpers (RBAC + ownership)."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import false, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Account, AccountAssignment, AdminUser


async def accessible_account_ids(db: AsyncSession, user: AdminUser) -> list[int] | None:
    """Return account IDs the user may access, or None if unrestricted (admin)."""
    if user.role == "admin":
        return None

    if user.role == "manager":
        team_subq = select(AdminUser.id).where(AdminUser.manager_id == user.id)
        q1 = select(AccountAssignment.account_id).where(AccountAssignment.user_id.in_(team_subq))
        q2 = select(Account.id).where(Account.tam_user_id.in_(team_subq))
        rows = (await db.execute(q1.union(q2))).fetchall()
        return list({r[0] for r in rows})

    if user.role in ("tam", "viewer"):
        q1 = select(AccountAssignment.account_id).where(AccountAssignment.user_id == user.id)
        q2 = select(Account.id).where(Account.tam_user_id == user.id)
        rows = (await db.execute(q1.union(q2))).fetchall()
        return list({r[0] for r in rows})

    return []


async def can_access_account(db: AsyncSession, user: AdminUser, account_id: int) -> bool:
    allowed = await accessible_account_ids(db, user)
    if allowed is None:
        return True
    return account_id in allowed


async def ensure_account_access(db: AsyncSession, user: AdminUser, account_id: int) -> None:
    if not await can_access_account(db, user, account_id):
        raise HTTPException(status_code=403, detail="No permission for this account")

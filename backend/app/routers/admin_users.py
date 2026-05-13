"""User administration — admin role only."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import hash_password, require_role
from ..database import get_db
from ..models import AdminUser
from ..schemas import AdminUserCreate, AdminUserRead, AdminUserUpdate

logger = logging.getLogger("tam_copilot.admin_users")

router = APIRouter(prefix="/admin/users", tags=["Admin users"])

_VALID_ROLES = frozenset({"admin", "manager", "tam", "viewer"})


def _to_read(u: AdminUser, manager_username: str | None = None) -> AdminUserRead:
    return AdminUserRead(
        id=u.id,
        username=u.username,
        full_name=u.full_name,
        email=u.email,
        role=u.role or "tam",
        tam_type=u.tam_type,
        manager_id=u.manager_id,
        manager_username=manager_username,
        is_active=u.is_active,
        created_at=u.created_at,
    )


@router.get("", response_model=list[AdminUserRead])
async def list_users(
    _caller: AdminUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(AdminUser).order_by(AdminUser.username))).scalars().all()
    id_to_username = {u.id: u.username for u in rows}
    out: list[AdminUserRead] = []
    for u in rows:
        mid = u.manager_id
        mname = id_to_username.get(mid) if mid else None
        out.append(_to_read(u, manager_username=mname))
    return out


@router.post("", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: AdminUserCreate,
    _caller: AdminUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in _VALID_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")
    exists = await db.scalar(select(AdminUser).where(AdminUser.username == body.username))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists")
    if body.manager_id is not None:
        mgr = await db.get(AdminUser, body.manager_id)
        if not mgr:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "manager_id not found")
    u = AdminUser(
        username=body.username,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        email=body.email,
        role=body.role,
        tam_type=body.tam_type,
        manager_id=body.manager_id,
        is_active=body.is_active,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    logger.info("admin_users.created | id=%s username=%s role=%s", u.id, u.username, u.role)
    mname = None
    if u.manager_id:
        mu = await db.get(AdminUser, u.manager_id)
        mname = mu.username if mu else None
    return _to_read(u, manager_username=mname)


@router.patch("/{user_id}", response_model=AdminUserRead)
async def update_user(
    user_id: int,
    body: AdminUserUpdate,
    caller: AdminUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(AdminUser, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if target.id == caller.id:
        if body.is_active is False:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot deactivate your own account")
        if body.role is not None and body.role != "admin":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot remove admin role from yourself")

    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        pwd = data.pop("password")
        if pwd is not None:
            if len(pwd) < 4:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 4 characters")
            target.password_hash = hash_password(pwd)

    if "role" in data and data["role"] is not None:
        if data["role"] not in _VALID_ROLES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")

    if "manager_id" in data and data["manager_id"] is not None:
        mgr = await db.get(AdminUser, data["manager_id"])
        if not mgr:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "manager_id not found")
        if mgr.id == target.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "User cannot be their own manager")

    for field, value in data.items():
        setattr(target, field, value)

    await db.commit()
    await db.refresh(target)
    logger.info("admin_users.updated | id=%s by=%s", user_id, caller.username)
    mname = None
    if target.manager_id:
        mu = await db.get(AdminUser, target.manager_id)
        mname = mu.username if mu else None
    return _to_read(target, manager_username=mname)

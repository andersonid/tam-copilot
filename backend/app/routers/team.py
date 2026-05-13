"""Team management for managers."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import AccountAssignment, AdminUser
from ..schemas import TeamMemberRead, TeamMemberUpdate

router = APIRouter(prefix="/team", tags=["Team"])


@router.get("/members", response_model=list[TeamMemberRead])
async def list_team_members(
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "admin":
        stmt = select(AdminUser).where(AdminUser.role.in_(("tam", "manager", "viewer"))).order_by(AdminUser.username)
    else:
        stmt = (
            select(AdminUser)
            .where(AdminUser.manager_id == user.id)
            .order_by(AdminUser.username)
        )
    members = (await db.execute(stmt)).scalars().all()
    out: list[TeamMemberRead] = []
    for m in members:
        cnt = await db.scalar(
            select(func.count(AccountAssignment.id)).where(AccountAssignment.user_id == m.id)
        ) or 0
        out.append(
            TeamMemberRead(
                id=m.id,
                username=m.username,
                full_name=m.full_name,
                email=m.email,
                role=m.role,
                tam_type=m.tam_type,
                is_active=m.is_active,
                manager_id=m.manager_id,
                account_count=int(cnt),
            )
        )
    return out


@router.patch("/members/{member_id}", response_model=TeamMemberRead)
async def update_team_member(
    member_id: int,
    body: TeamMemberUpdate,
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(AdminUser, member_id)
    if not target:
        raise HTTPException(404, "User not found")
    if user.role == "manager":
        if target.manager_id != user.id and target.id != user.id:
            raise HTTPException(403, "You can only edit members of your team")
    if body.manager_id is not None and user.role != "admin":
        if body.manager_id != user.id:
            raise HTTPException(403, "Managers may only set themselves as the assigned manager")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    await db.commit()
    await db.refresh(target)
    cnt = await db.scalar(
        select(func.count(AccountAssignment.id)).where(AccountAssignment.user_id == target.id)
    ) or 0
    return TeamMemberRead(
        id=target.id,
        username=target.username,
        full_name=target.full_name,
        email=target.email,
        role=target.role,
        tam_type=target.tam_type,
        is_active=target.is_active,
        manager_id=target.manager_id,
        account_count=int(cnt),
    )

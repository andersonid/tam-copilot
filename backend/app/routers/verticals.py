"""Vertical reference data (customer classification)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import AdminUser, Vertical
from ..schemas import VerticalRead

router = APIRouter(prefix="/verticals", tags=["Verticals"])


class VerticalCreateBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    is_active: bool = True


class VerticalPatchBody(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None


@router.get("", response_model=list[VerticalRead])
async def list_verticals(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
):
    stmt = select(Vertical).order_by(Vertical.name)
    if not include_inactive:
        stmt = stmt.where(Vertical.is_active == True)  # noqa: E712
    rows = (await db.execute(stmt)).scalars().all()
    return [VerticalRead.model_validate(r) for r in rows]


@router.post("", response_model=VerticalRead, status_code=201)
async def create_vertical(
    body: VerticalCreateBody,
    db: AsyncSession = Depends(get_db),
    _user: AdminUser = Depends(require_role("admin", "manager")),
):
    v = Vertical(name=body.name, is_active=body.is_active)
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return VerticalRead.model_validate(v)


@router.patch("/{vertical_id}", response_model=VerticalRead)
async def patch_vertical(
    vertical_id: int,
    body: VerticalPatchBody,
    db: AsyncSession = Depends(get_db),
    _user: AdminUser = Depends(require_role("admin", "manager")),
):
    v = await db.get(Vertical, vertical_id)
    if not v:
        raise HTTPException(404, "Vertical not found")
    if body.name is not None:
        v.name = body.name
    if body.is_active is not None:
        v.is_active = body.is_active
    await db.commit()
    await db.refresh(v)
    return VerticalRead.model_validate(v)

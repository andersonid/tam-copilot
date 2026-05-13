"""Segment reference data (industry classification)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import AdminUser, Segment
from ..schemas import SegmentRead

router = APIRouter(prefix="/segments", tags=["Segments"])


class SegmentCreateBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    is_active: bool = True


class SegmentPatchBody(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None


@router.get("", response_model=list[SegmentRead])
async def list_segments(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    _user: AdminUser = Depends(get_current_user),
):
    stmt = select(Segment).order_by(Segment.name)
    if not include_inactive:
        stmt = stmt.where(Segment.is_active == True)  # noqa: E712
    rows = (await db.execute(stmt)).scalars().all()
    return [SegmentRead.model_validate(r) for r in rows]


@router.post("", response_model=SegmentRead, status_code=201)
async def create_segment(
    body: SegmentCreateBody,
    db: AsyncSession = Depends(get_db),
    _user: AdminUser = Depends(require_role("admin", "manager")),
):
    s = Segment(name=body.name, is_active=body.is_active)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return SegmentRead.model_validate(s)


@router.patch("/{segment_id}", response_model=SegmentRead)
async def patch_segment(
    segment_id: int,
    body: SegmentPatchBody,
    db: AsyncSession = Depends(get_db),
    _user: AdminUser = Depends(require_role("admin", "manager")),
):
    s = await db.get(Segment, segment_id)
    if not s:
        raise HTTPException(404, "Segment not found")
    if body.name is not None:
        s.name = body.name
    if body.is_active is not None:
        s.is_active = body.is_active
    await db.commit()
    await db.refresh(s)
    return SegmentRead.model_validate(s)

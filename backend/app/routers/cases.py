"""Support cases endpoints (read-only, synced from Hydra)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, false
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..auth import get_current_user
from ..models import AdminUser, SupportCase
from ..schemas import CaseRead
from ..access import accessible_account_ids, ensure_account_access

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.get("", response_model=list[CaseRead], summary="List support cases")
async def list_cases(
    account_id: int | None = Query(None),
    status: str | None = Query(None, description="Filter: Closed, Waiting on Red Hat, etc."),
    severity: str | None = Query(None, description="Filter: 1 (Urgent), 2 (High), etc."),
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = await accessible_account_ids(db, user)
    stmt = select(SupportCase).order_by(SupportCase.last_modified_date.desc())
    if account_id is not None:
        await ensure_account_access(db, user, account_id)
        stmt = stmt.where(SupportCase.account_id == account_id)
    elif allowed is not None:
        if not allowed:
            stmt = stmt.where(false())
        else:
            stmt = stmt.where(SupportCase.account_id.in_(allowed))
    if status:
        stmt = stmt.where(SupportCase.status == status)
    if severity:
        stmt = stmt.where(SupportCase.severity == severity)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{case_id}", response_model=CaseRead, summary="Get single case")
async def get_case(
    case_id: int,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(SupportCase, case_id)
    if not item:
        from fastapi import HTTPException
        raise HTTPException(404, "Case not found")
    await ensure_account_access(db, user, item.account_id)
    return item

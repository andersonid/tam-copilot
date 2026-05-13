"""NPS survey endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import NpsSurvey, Account
from ..schemas import NpsCreate, NpsRead

logger = logging.getLogger("tam_copilot.nps")

router = APIRouter(prefix="/nps", tags=["NPS Surveys"])


@router.get(
    "",
    response_model=list[NpsRead],
    summary="List NPS surveys",
    description="List NPS surveys, optionally filtered by account or TAM.",
)
async def list_nps(
    account_id: int | None = Query(None),
    tam_user_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(NpsSurvey).order_by(NpsSurvey.survey_date.desc())
    if account_id is not None:
        stmt = stmt.where(NpsSurvey.account_id == account_id)
    if tam_user_id is not None:
        stmt = stmt.where(NpsSurvey.tam_user_id == tam_user_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=NpsRead,
    status_code=201,
    summary="Record NPS survey",
)
async def create_nps(body: NpsCreate, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, body.account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    nps = NpsSurvey(**body.model_dump())
    db.add(nps)
    await db.commit()
    await db.refresh(nps)
    logger.info("nps.created | id=%d account_id=%d score=%d", nps.id, nps.account_id, nps.score)
    return nps


@router.delete(
    "/{nps_id}",
    status_code=204,
    summary="Delete NPS survey",
)
async def delete_nps(nps_id: int, db: AsyncSession = Depends(get_db)):
    nps = await db.get(NpsSurvey, nps_id)
    if not nps:
        raise HTTPException(404, "NPS survey not found")
    await db.delete(nps)
    await db.commit()

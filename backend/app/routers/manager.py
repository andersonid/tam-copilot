"""Cross-account manager views (action plans, engagement, summary)."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..access import accessible_account_ids
from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Account, ActionPlan, Engagement, AdminUser
from ..schemas import ChartDataPoint

router = APIRouter(prefix="/manager", tags=["Manager"])


class UnifiedActionPlanRow(BaseModel):
    id: int
    account_id: int
    account_name: str
    account_number: str
    description: str
    initiative_type: str | None
    product: str | None
    status: str
    tam_name: str | None
    business_impact: str | None
    start_year: int | None
    start_quarter: str | None
    close_year: int | None
    close_quarter: str | None


class EngagementRollupRow(BaseModel):
    account_id: int
    account_name: str
    account_number: str
    year: int
    customer_area: str
    py_engagement: str | None
    q1_engagement: str | None
    q2_engagement: str | None
    q3_engagement: str | None
    q4_engagement: str | None


class ManagerSummary(BaseModel):
    account_count: int
    active_accounts: int
    team_member_count: int
    action_plans_open: int
    action_plans_done: int


@router.get("/action-plans", response_model=list[UnifiedActionPlanRow])
async def unified_action_plans(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status"),
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    allowed = await accessible_account_ids(db, user)
    if allowed is not None and not allowed:
        return []
    stmt = (
        select(ActionPlan, Account.name, Account.account_number)
        .join(Account, Account.id == ActionPlan.account_id)
        .order_by(ActionPlan.id.desc())
    )
    if allowed is not None:
        stmt = stmt.where(ActionPlan.account_id.in_(allowed))
    if status_filter:
        stmt = stmt.where(ActionPlan.status == status_filter)
    offset = (page - 1) * size
    stmt = stmt.offset(offset).limit(size)
    rows = (await db.execute(stmt)).all()
    return [
        UnifiedActionPlanRow(
            id=ap.id,
            account_id=ap.account_id,
            account_name=name,
            account_number=num,
            description=ap.description[:500] if ap.description else "",
            initiative_type=ap.initiative_type,
            product=ap.product,
            status=ap.status,
            tam_name=ap.tam_name,
            business_impact=ap.business_impact,
            start_year=ap.start_year,
            start_quarter=ap.start_quarter,
            close_year=ap.close_year,
            close_quarter=ap.close_quarter,
        )
        for ap, name, num in rows
    ]


@router.get("/engagement", response_model=list[EngagementRollupRow])
async def engagement_rollup(
    year: int | None = None,
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime

    y = year or datetime.now().year
    allowed = await accessible_account_ids(db, user)
    if allowed is not None and not allowed:
        return []
    stmt = (
        select(Engagement, Account.name, Account.account_number)
        .join(Account, Account.id == Engagement.account_id)
        .where(Engagement.year == y)
        .order_by(Account.name, Engagement.customer_area)
    )
    if allowed is not None:
        stmt = stmt.where(Engagement.account_id.in_(allowed))
    rows = (await db.execute(stmt)).all()
    return [
        EngagementRollupRow(
            account_id=e.account_id,
            account_name=name,
            account_number=num,
            year=e.year,
            customer_area=e.customer_area,
            py_engagement=e.py_engagement,
            q1_engagement=e.q1_engagement,
            q2_engagement=e.q2_engagement,
            q3_engagement=e.q3_engagement,
            q4_engagement=e.q4_engagement,
        )
        for e, name, num in rows
    ]


@router.get("/summary", response_model=ManagerSummary)
async def manager_summary(
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    allowed = await accessible_account_ids(db, user)
    if allowed is None:
        acct_total = await db.scalar(select(func.count()).select_from(Account)) or 0
        active = await db.scalar(select(func.count()).select_from(Account).where(Account.is_active == True))  # noqa: E712
        team = await db.scalar(select(func.count()).select_from(AdminUser).where(AdminUser.role == "tam")) or 0
        ap_open = await db.scalar(
            select(func.count()).select_from(ActionPlan).where(ActionPlan.status.notin_(("Done", "Completed")))
        ) or 0
        ap_done = await db.scalar(
            select(func.count()).select_from(ActionPlan).where(ActionPlan.status.in_(("Done", "Completed")))
        ) or 0
    else:
        acct_total = len(allowed)
        active = await db.scalar(
            select(func.count()).select_from(Account).where(Account.id.in_(allowed), Account.is_active == True)  # noqa: E712
        ) or 0
        team = await db.scalar(
            select(func.count()).select_from(AdminUser).where(AdminUser.manager_id == user.id)
        ) or 0
        ap_open = await db.scalar(
            select(func.count())
            .select_from(ActionPlan)
            .where(
                ActionPlan.account_id.in_(allowed),
                ActionPlan.status.notin_(("Done", "Completed")),
            )
        ) or 0
        ap_done = await db.scalar(
            select(func.count())
            .select_from(ActionPlan)
            .where(
                ActionPlan.account_id.in_(allowed),
                ActionPlan.status.in_(("Done", "Completed")),
            )
        ) or 0
    return ManagerSummary(
        account_count=int(acct_total),
        active_accounts=int(active or 0),
        team_member_count=int(team),
        action_plans_open=int(ap_open),
        action_plans_done=int(ap_done),
    )


class ManagerReportsOut(BaseModel):
    action_plans_by_status: list[ChartDataPoint]
    action_plans_by_product: list[ChartDataPoint]


@router.get("/reports", response_model=ManagerReportsOut)
async def manager_reports(
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    allowed = await accessible_account_ids(db, user)
    status_stmt = (
        select(ActionPlan.status, func.count(ActionPlan.id))
        .group_by(ActionPlan.status)
        .order_by(func.count(ActionPlan.id).desc())
    )
    prod_stmt = (
        select(ActionPlan.product, func.count(ActionPlan.id))
        .where(ActionPlan.product.isnot(None), ActionPlan.product != "")
        .group_by(ActionPlan.product)
        .order_by(func.count(ActionPlan.id).desc())
        .limit(15)
    )
    if allowed is not None:
        if not allowed:
            return ManagerReportsOut(action_plans_by_status=[], action_plans_by_product=[])
        status_stmt = status_stmt.where(ActionPlan.account_id.in_(allowed))
        prod_stmt = prod_stmt.where(ActionPlan.account_id.in_(allowed))
    by_status = (await db.execute(status_stmt)).all()
    by_prod = (await db.execute(prod_stmt)).all()
    return ManagerReportsOut(
        action_plans_by_status=[ChartDataPoint(label=r[0] or "—", value=r[1]) for r in by_status],
        action_plans_by_product=[ChartDataPoint(label=r[0] or "—", value=r[1]) for r in by_prod],
    )

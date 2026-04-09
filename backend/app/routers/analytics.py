from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Guide, Customer, Product, DocumentType, LLMProvider, Tag, guide_tags
from ..schemas import AnalyticsOverview, ChartDataPoint, TimeSeriesPoint

router = APIRouter(tags=["analytics"])


@router.get("/analytics/overview", response_model=AnalyticsOverview)
async def analytics_overview(db: AsyncSession = Depends(get_db)):
    total = await db.scalar(select(func.count(Guide.id))) or 0
    now = datetime.now()
    month_count = await db.scalar(
        select(func.count(Guide.id)).where(
            extract("year", Guide.created_at) == now.year,
            extract("month", Guide.created_at) == now.month,
        )
    ) or 0
    customers = await db.scalar(select(func.count(Customer.id))) or 0
    providers = await db.scalar(
        select(func.count(LLMProvider.id)).where(LLMProvider.is_active == True)
    ) or 0
    return AnalyticsOverview(
        total_guides=total,
        guides_this_month=month_count,
        total_customers=customers,
        active_providers=providers,
    )


@router.get("/analytics/by-product", response_model=list[ChartDataPoint])
async def by_product(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product.name, func.count(Guide.id))
        .join(Guide, Guide.product_id == Product.id)
        .group_by(Product.name)
        .order_by(func.count(Guide.id).desc())
    )
    return [ChartDataPoint(label=row[0], value=row[1]) for row in result.all()]


@router.get("/analytics/by-customer", response_model=list[ChartDataPoint])
async def by_customer(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer.name, func.count(Guide.id))
        .join(Guide, Guide.customer_id == Customer.id)
        .group_by(Customer.name)
        .order_by(func.count(Guide.id).desc())
        .limit(10)
    )
    return [ChartDataPoint(label=row[0], value=row[1]) for row in result.all()]


@router.get("/analytics/by-type", response_model=list[ChartDataPoint])
async def by_type(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DocumentType.name, func.count(Guide.id))
        .join(Guide, Guide.document_type_id == DocumentType.id)
        .group_by(DocumentType.name)
        .order_by(func.count(Guide.id).desc())
    )
    return [ChartDataPoint(label=row[0], value=row[1]) for row in result.all()]


@router.get("/analytics/top-tags", response_model=list[ChartDataPoint])
async def top_tags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tag.name, func.count(guide_tags.c.guide_id))
        .join(guide_tags, Tag.id == guide_tags.c.tag_id)
        .group_by(Tag.name)
        .order_by(func.count(guide_tags.c.guide_id).desc())
        .limit(20)
    )
    return [ChartDataPoint(label=row[0], value=row[1]) for row in result.all()]


@router.get("/analytics/provider-usage", response_model=list[ChartDataPoint])
async def provider_usage(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.coalesce(LLMProvider.name, "Unknown"),
            func.count(Guide.id),
        )
        .outerjoin(LLMProvider, Guide.provider_id == LLMProvider.id)
        .group_by(LLMProvider.name)
        .order_by(func.count(Guide.id).desc())
    )
    return [ChartDataPoint(label=row[0], value=row[1]) for row in result.all()]

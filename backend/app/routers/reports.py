"""TAM Report generation endpoint.

Compiles account data into a structured report, renders it as HTML
using the base template, and saves it as a Guide linked to the account.
"""

import logging
import secrets
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models import Account, Guide, DocumentType, Customer, Product
from ..services.report_compiler import compile_tam_report
from ..services.renderer import render_guide

logger = logging.getLogger("tam_copilot.routers.reports")

router = APIRouter(prefix="/v1/reports", tags=["Reports"])


@router.post(
    "/tam/{account_id}",
    summary="Generate TAM Report",
    description=(
        "Compiles all account data (clusters, entitlements, risks, "
        "action plans, touchpoints, engagement) into a formatted HTML "
        "TAM Report and saves it as a Guide record."
    ),
)
async def generate_tam_report(account_id: int, db: AsyncSession = Depends(get_db)):
    """Generate a comprehensive TAM Report for the given account."""
    account = await db.scalar(select(Account).where(Account.id == account_id))
    if not account:
        raise HTTPException(404, f"Account {account_id} not found")

    report_data = await compile_tam_report(db, account_id)

    html = render_guide(
        report_data,
        doc_type_slug="tam-report",
        customer_name=account.name,
        product_name="",
        touchpoint_date=date.today().isoformat(),
    )

    filename = f"tam_report_{account.account_number}_{date.today().isoformat()}.html"
    html_dir = Path(settings.data_dir) / "html"
    html_dir.mkdir(parents=True, exist_ok=True)
    (html_dir / filename).write_text(html, encoding="utf-8")

    doc_type = await db.scalar(select(DocumentType).where(DocumentType.slug == "tam-report"))
    if not doc_type:
        doc_type = DocumentType(name="TAM Report", slug="tam-report", color="#CC0000")
        db.add(doc_type)
        await db.flush()

    customer = await db.scalar(select(Customer).where(Customer.name == account.name))
    if not customer:
        customer = Customer(name=account.name, slug=account.account_number)
        db.add(customer)
        await db.flush()

    product = await db.scalar(select(Product).limit(1))
    if not product:
        product = Product(name="General", slug="general")
        db.add(product)
        await db.flush()

    guide = Guide(
        title=f"TAM Report — {account.name} — {date.today().isoformat()}",
        customer_id=customer.id,
        product_id=product.id,
        document_type_id=doc_type.id,
        account_id=account.id,
        html_filename=filename,
        status="generated",
        input_notes=f"Auto-generated TAM Report for {account.name}",
        access_token=secrets.token_urlsafe(24),
    )
    db.add(guide)
    await db.commit()
    await db.refresh(guide)

    logger.info("report.generated | account=%s guide_id=%d", account.account_number, guide.id)

    return {
        "guide_id": guide.id,
        "title": guide.title,
        "filename": filename,
        "access_token": guide.access_token,
        "sections_count": len(report_data.get("sections", [])),
    }

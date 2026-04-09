import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import DocumentType
from ..schemas import DocumentTypeCreate, DocumentTypeRead

router = APIRouter(tags=["document_types"])


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[\s_]+", "-", s)


@router.get("/document-types", response_model=list[DocumentTypeRead])
async def list_document_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DocumentType).order_by(DocumentType.name))
    return result.scalars().all()


@router.post("/document-types", response_model=DocumentTypeRead, status_code=201)
async def create_document_type(data: DocumentTypeCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(DocumentType).where(DocumentType.name == data.name))
    if existing:
        raise HTTPException(400, "Document type already exists")
    dt = DocumentType(name=data.name, slug=_slugify(data.name), color=data.color)
    db.add(dt)
    await db.commit()
    await db.refresh(dt)
    return dt

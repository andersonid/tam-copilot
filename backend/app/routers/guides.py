from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Guide, Tag, LLMProvider, Customer, Product, DocumentType
from ..schemas import GuideCreate, GuideRead, GuideListRead, CheckSimilarRequest, CheckSimilarResponse, SimilarGuide
from ..crypto import decrypt_api_key

router = APIRouter(tags=["guides"])


async def _get_or_create_tags(db: AsyncSession, tag_names: list[str]) -> list[Tag]:
    tags = []
    for name in tag_names:
        name = name.strip().lower()
        if not name:
            continue
        tag = await db.scalar(select(Tag).where(Tag.name == name))
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            await db.flush()
        tags.append(tag)
    return tags


@router.get("/guides", response_model=list[GuideListRead])
async def list_guides(
    customer_id: int | None = None,
    product_id: int | None = None,
    document_type_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Guide).options(
        selectinload(Guide.customer),
        selectinload(Guide.product),
        selectinload(Guide.document_type),
    ).order_by(Guide.touchpoint_date.desc(), Guide.created_at.desc())
    if customer_id:
        q = q.where(Guide.customer_id == customer_id)
    if product_id:
        q = q.where(Guide.product_id == product_id)
    if document_type_id:
        q = q.where(Guide.document_type_id == document_type_id)
    if date_from:
        q = q.where(Guide.touchpoint_date >= date_from)
    if date_to:
        q = q.where(Guide.touchpoint_date <= date_to)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/guides", response_model=GuideRead, status_code=201)
async def create_guide(data: GuideCreate, db: AsyncSession = Depends(get_db)):
    if data.provider_id:
        provider = await db.get(LLMProvider, data.provider_id)
    else:
        provider = await db.scalar(select(LLMProvider).where(LLMProvider.is_default == True))
    if not provider:
        raise HTTPException(400, "No LLM provider available")

    title = data.title or "Generating..."
    guide = Guide(
        title=title,
        customer_id=data.customer_id,
        product_id=data.product_id,
        document_type_id=data.document_type_id,
        provider_id=provider.id,
        model_used=data.model_override or provider.default_model,
        touchpoint_date=data.touchpoint_date,
        input_notes=data.input_notes,
        status="generating",
        kcs_subtype=data.kcs_subtype,
    )
    if data.tags:
        guide.tags = await _get_or_create_tags(db, data.tags)
    db.add(guide)
    await db.flush()

    try:
        from ..services.llm_base import get_llm_client
        from ..services.renderer import render_guide
        from ..services.prompts import build_prompt
        from ..services.embeddings import get_embedding
        from ..config import settings

        api_key = decrypt_api_key(provider.api_key_encrypted) if provider.api_key_encrypted else None
        client = get_llm_client(provider.provider_type, provider.base_url, api_key)

        doc_type = await db.get(DocumentType, data.document_type_id)
        product = await db.get(Product, data.product_id)
        customer = await db.get(Customer, data.customer_id)

        system_prompt, user_msg = build_prompt(
            doc_type_slug=doc_type.slug if doc_type else "rca",
            product_name=product.name if product else "",
            customer_name=customer.name if customer else "",
            kcs_subtype=data.kcs_subtype,
        )
        model = data.model_override or provider.default_model
        structured = await client.generate_structured(system_prompt, user_msg + "\n\n" + data.input_notes, model)

        if not data.title and structured.get("title"):
            guide.title = structured["title"]

        html_content = render_guide(structured, doc_type.slug if doc_type else "rca", data.kcs_subtype)
        filename = f"guide_{guide.id}.html"
        html_path = settings.html_dir / filename
        html_path.write_text(html_content, encoding="utf-8")
        guide.html_filename = filename
        guide.status = "generated"

        try:
            emb = await get_embedding(data.input_notes)
            if emb is not None:
                import numpy as np
                guide.embedding = np.array(emb, dtype=np.float32).tobytes()
        except Exception:
            pass

        try:
            await db.execute(text(
                "INSERT INTO guide_fts(rowid, title, input_notes) VALUES (:id, :title, :notes)"
            ), {"id": guide.id, "title": guide.title, "notes": data.input_notes})
        except Exception:
            pass

    except Exception as e:
        guide.status = "error"
        guide.title = data.title or f"Error: {str(e)[:100]}"

    await db.commit()

    result = await db.execute(
        select(Guide).options(
            selectinload(Guide.customer),
            selectinload(Guide.product),
            selectinload(Guide.document_type),
            selectinload(Guide.provider),
            selectinload(Guide.tags),
        ).where(Guide.id == guide.id)
    )
    return result.scalar_one()


@router.get("/guides/{guide_id}", response_model=GuideRead)
async def get_guide(guide_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Guide).options(
            selectinload(Guide.customer),
            selectinload(Guide.product),
            selectinload(Guide.document_type),
            selectinload(Guide.provider),
            selectinload(Guide.tags),
        ).where(Guide.id == guide_id)
    )
    guide = result.scalar_one_or_none()
    if not guide:
        raise HTTPException(404, "Guide not found")
    return guide


@router.delete("/guides/{guide_id}", status_code=204)
async def delete_guide(guide_id: int, db: AsyncSession = Depends(get_db)):
    guide = await db.get(Guide, guide_id)
    if not guide:
        raise HTTPException(404, "Guide not found")
    if guide.html_filename:
        from ..config import settings
        html_path = settings.html_dir / guide.html_filename
        if html_path.exists():
            html_path.unlink()
    try:
        await db.execute(text("DELETE FROM guide_fts WHERE rowid = :id"), {"id": guide_id})
    except Exception:
        pass
    await db.delete(guide)
    await db.commit()


@router.get("/guides/{guide_id}/related", response_model=list[SimilarGuide])
async def get_related_guides(guide_id: int, db: AsyncSession = Depends(get_db)):
    guide = await db.get(Guide, guide_id)
    if not guide or not guide.embedding:
        return []
    from ..services.similarity import find_similar_by_embedding
    return await find_similar_by_embedding(db, guide.embedding, exclude_id=guide_id, limit=5)


@router.post("/guides/{guide_id}/regenerate", response_model=GuideRead)
async def regenerate_guide(guide_id: int, provider_id: int | None = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Guide).options(
            selectinload(Guide.customer),
            selectinload(Guide.product),
            selectinload(Guide.document_type),
            selectinload(Guide.provider),
            selectinload(Guide.tags),
        ).where(Guide.id == guide_id)
    )
    guide = result.scalar_one_or_none()
    if not guide:
        raise HTTPException(404, "Guide not found")

    if provider_id:
        provider = await db.get(LLMProvider, provider_id)
    elif guide.provider_id:
        provider = await db.get(LLMProvider, guide.provider_id)
    else:
        provider = await db.scalar(select(LLMProvider).where(LLMProvider.is_default == True))
    if not provider:
        raise HTTPException(400, "No LLM provider available")

    try:
        from ..services.llm_base import get_llm_client
        from ..services.renderer import render_guide
        from ..services.prompts import build_prompt
        from ..services.embeddings import get_embedding
        from ..config import settings

        api_key = decrypt_api_key(provider.api_key_encrypted) if provider.api_key_encrypted else None
        client = get_llm_client(provider.provider_type, provider.base_url, api_key)

        system_prompt, user_msg = build_prompt(
            doc_type_slug=guide.document_type.slug if guide.document_type else "rca",
            product_name=guide.product.name if guide.product else "",
            customer_name=guide.customer.name if guide.customer else "",
            kcs_subtype=guide.kcs_subtype,
        )
        model = provider.default_model
        structured = await client.generate_structured(system_prompt, user_msg + "\n\n" + guide.input_notes, model)

        if structured.get("title"):
            guide.title = structured["title"]

        html_content = render_guide(structured, guide.document_type.slug if guide.document_type else "rca", guide.kcs_subtype)
        filename = f"guide_{guide.id}.html"
        html_path = settings.html_dir / filename
        html_path.write_text(html_content, encoding="utf-8")
        guide.html_filename = filename
        guide.provider_id = provider.id
        guide.model_used = model
        guide.status = "generated"

        try:
            emb = await get_embedding(guide.input_notes)
            if emb is not None:
                import numpy as np
                guide.embedding = np.array(emb, dtype=np.float32).tobytes()
        except Exception:
            pass

    except Exception as e:
        guide.status = "error"

    await db.commit()
    await db.refresh(guide)
    return guide


@router.post("/guides/check-similar", response_model=CheckSimilarResponse)
async def check_similar(data: CheckSimilarRequest, db: AsyncSession = Depends(get_db)):
    from ..services.similarity import find_similar_by_text
    similar = await find_similar_by_text(db, data.input_notes)
    return CheckSimilarResponse(
        has_similar=len(similar) > 0,
        similar_guides=similar,
    )

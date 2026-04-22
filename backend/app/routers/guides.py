import logging
import time
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Guide, Tag, LLMProvider, Customer, Product, DocumentType
from ..schemas import GuideCreate, GuideRead, GuideListRead, CheckSimilarRequest, CheckSimilarResponse, SimilarGuide
from ..crypto import decrypt_api_key

logger = logging.getLogger("tam_copilot.guides")
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
    t_total = time.perf_counter()
    logger.info(
        "guide.create.start | customer_id=%s product_id=%s doc_type_id=%s provider_id=%s notes_len=%d",
        data.customer_id, data.product_id, data.document_type_id, data.provider_id, len(data.input_notes),
    )

    if data.provider_id:
        provider = await db.get(LLMProvider, data.provider_id)
    else:
        provider = await db.scalar(select(LLMProvider).where(LLMProvider.is_default == True))
    if not provider:
        logger.error("guide.create.fail | reason=no_provider_available")
        raise HTTPException(400, "No LLM provider available")

    model = data.model_override or provider.default_model
    logger.info(
        "guide.create.provider | name=%s type=%s model=%s base_url=%s",
        provider.name, provider.provider_type, model, provider.base_url,
    )

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

    slug = doc_type.slug if doc_type else "rca"
    system_prompt, user_msg = build_prompt(
        doc_type_slug=slug,
        product_name=product.name if product else "",
        customer_name=customer.name if customer else "",
        kcs_subtype=data.kcs_subtype,
    )
    logger.info(
        "guide.create.prompt | doc_type=%s kcs_subtype=%s system_prompt_len=%d user_msg_len=%d",
        slug, data.kcs_subtype, len(system_prompt), len(user_msg) + len(data.input_notes),
    )

    # --- LLM call (fail fast — nothing saved yet) ---
    try:
        t_llm = time.perf_counter()
        structured = await client.generate_structured(system_prompt, user_msg + "\n\n" + data.input_notes, model)
        llm_elapsed = time.perf_counter() - t_llm
        section_count = len(structured.get("sections", []))
        logger.info(
            "guide.create.llm_done | model=%s elapsed=%.2fs sections=%d keys=%s",
            model, llm_elapsed, section_count, list(structured.keys()),
        )
    except Exception as llm_err:
        elapsed = time.perf_counter() - t_total
        err_type = type(llm_err).__name__
        err_msg = str(llm_err)[:500]
        logger.error("guide.create.llm_failed | model=%s elapsed=%.2fs error_type=%s error=%s",
                      model, elapsed, err_type, err_msg, exc_info=True)
        raise HTTPException(502, detail={
            "summary": f"LLM generation failed ({err_type})",
            "error_type": err_type,
            "message": err_msg,
            "provider": provider.name,
            "model": model,
            "elapsed_seconds": round(elapsed, 1),
            "hint": _error_hint(llm_err),
        })

    # --- LLM succeeded — persist the guide ---
    title = data.title or structured.get("title") or "Untitled Guide"
    guide = Guide(
        title=title,
        customer_id=data.customer_id,
        product_id=data.product_id,
        document_type_id=data.document_type_id,
        provider_id=provider.id,
        model_used=model,
        touchpoint_date=data.touchpoint_date,
        input_notes=data.input_notes,
        status="generated",
        kcs_subtype=data.kcs_subtype,
    )
    if data.tags:
        guide.tags = await _get_or_create_tags(db, data.tags)
    db.add(guide)
    await db.flush()
    logger.info("guide.create.record | guide_id=%d title=%r", guide.id, title)

    t_render = time.perf_counter()
    html_content = render_guide(structured, slug, data.kcs_subtype)
    render_elapsed = time.perf_counter() - t_render
    filename = f"guide_{guide.id}.html"
    html_path = settings.html_dir / filename
    html_path.write_text(html_content, encoding="utf-8")
    guide.html_filename = filename
    logger.info(
        "guide.create.rendered | filename=%s html_size=%d elapsed=%.3fs",
        filename, len(html_content), render_elapsed,
    )

    t_emb = time.perf_counter()
    try:
        emb = await get_embedding(data.input_notes)
        emb_elapsed = time.perf_counter() - t_emb
        if emb is not None:
            import numpy as np
            guide.embedding = np.array(emb, dtype=np.float32).tobytes()
            logger.info("guide.create.embedding | dims=%d elapsed=%.2fs", len(emb), emb_elapsed)
        else:
            logger.warning("guide.create.embedding | result=null elapsed=%.2fs", emb_elapsed)
    except Exception as emb_err:
        logger.warning("guide.create.embedding | error=%s elapsed=%.2fs", emb_err, time.perf_counter() - t_emb)

    try:
        await db.execute(text(
            "INSERT INTO guide_fts(rowid, title, input_notes) VALUES (:id, :title, :notes)"
        ), {"id": guide.id, "title": guide.title, "notes": data.input_notes})
        logger.info("guide.create.fts_indexed | guide_id=%d", guide.id)
    except Exception as fts_err:
        logger.warning("guide.create.fts_index_fail | error=%s", fts_err)

    await db.commit()

    total_elapsed = time.perf_counter() - t_total
    logger.info(
        "guide.create.done | guide_id=%d status=%s title=%r total_elapsed=%.2fs",
        guide.id, guide.status, guide.title, total_elapsed,
    )

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


def _error_hint(err: Exception) -> str:
    """Return a user-friendly troubleshooting hint based on the error type."""
    msg = str(err).lower()
    if "connection" in msg or "disconnected" in msg:
        return "The LLM provider closed the connection. This usually means the model is too slow or the provider has a server-side timeout. Try a different/faster model, or check VPN connectivity."
    if "timeout" in msg:
        return "Request timed out waiting for the LLM response. The model may be overloaded. Try again later or use a faster model."
    if "401" in msg or "unauthorized" in msg or "invalid api key" in msg:
        return "Authentication failed. Check the API key configured for this provider in Administration > LLM Providers."
    if "429" in msg or "rate limit" in msg:
        return "Rate limit exceeded. Wait a moment and try again."
    if "json" in msg or "parse" in msg:
        return "The LLM returned invalid JSON. Try regenerating — this can be intermittent."
    return "Check the backend logs for full details. If the error persists, try a different LLM provider or model."


@router.post("/guides/import", response_model=GuideRead, status_code=201)
async def import_guide(
    html_file: UploadFile = File(...),
    title: str = Form(...),
    customer_id: int = Form(...),
    product_id: int = Form(...),
    document_type_id: int = Form(...),
    touchpoint_date: date = Form(default_factory=date.today),
    tags: str = Form(default=""),
    kcs_subtype: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
):
    t0 = time.perf_counter()
    logger.info(
        "guide.import.start | title=%r customer_id=%s product_id=%s doc_type_id=%s filename=%s",
        title, customer_id, product_id, document_type_id, html_file.filename,
    )

    if not html_file.content_type or "html" not in html_file.content_type:
        if html_file.filename and not html_file.filename.endswith((".html", ".htm")):
            raise HTTPException(400, "Only HTML files are accepted")

    html_bytes = await html_file.read()
    html_content = html_bytes.decode("utf-8")
    logger.info("guide.import.file_read | size=%d bytes", len(html_bytes))

    tag_names = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    guide = Guide(
        title=title,
        customer_id=customer_id,
        product_id=product_id,
        document_type_id=document_type_id,
        touchpoint_date=touchpoint_date,
        input_notes=f"[Imported from {html_file.filename or 'upload'}]",
        status="generated",
        kcs_subtype=kcs_subtype or None,
    )
    if tag_names:
        guide.tags = await _get_or_create_tags(db, tag_names)
    db.add(guide)
    await db.flush()

    from ..config import settings

    filename = f"guide_{guide.id}.html"
    html_path = settings.html_dir / filename
    html_path.write_text(html_content, encoding="utf-8")
    guide.html_filename = filename
    logger.info("guide.import.saved | guide_id=%d filename=%s", guide.id, filename)

    try:
        from ..services.embeddings import get_embedding
        import numpy as np

        emb = await get_embedding(title + " " + html_content[:2000])
        if emb is not None:
            guide.embedding = np.array(emb, dtype=np.float32).tobytes()
            logger.info("guide.import.embedding | dims=%d", len(emb))
    except Exception as emb_err:
        logger.warning("guide.import.embedding | error=%s", emb_err)

    try:
        await db.execute(text(
            "INSERT INTO guide_fts(rowid, title, input_notes) VALUES (:id, :title, :notes)"
        ), {"id": guide.id, "title": guide.title, "notes": guide.input_notes})
    except Exception as fts_err:
        logger.warning("guide.import.fts_index_fail | error=%s", fts_err)

    await db.commit()

    elapsed = time.perf_counter() - t0
    logger.info("guide.import.done | guide_id=%d elapsed=%.2fs", guide.id, elapsed)

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


@router.delete("/guides/errors", status_code=200)
async def purge_error_guides(db: AsyncSession = Depends(get_db)):
    """Delete all guides with status='error' or 'generating' (stale)."""
    result = await db.execute(
        select(Guide).where(Guide.status.in_(["error", "generating"]))
    )
    guides = result.scalars().all()
    count = len(guides)
    if count == 0:
        return {"deleted": 0}
    from ..config import settings
    for g in guides:
        if g.html_filename:
            html_path = settings.html_dir / g.html_filename
            if html_path.exists():
                html_path.unlink()
        try:
            await db.execute(text("DELETE FROM guide_fts WHERE rowid = :id"), {"id": g.id})
        except Exception:
            pass
        await db.delete(g)
    await db.commit()
    logger.info("guide.purge_errors | deleted=%d", count)
    return {"deleted": count}


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
    t_total = time.perf_counter()
    logger.info("guide.regenerate.start | guide_id=%d provider_id=%s", guide_id, provider_id)

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
        logger.error("guide.regenerate.fail | guide_id=%d reason=no_provider_available", guide_id)
        raise HTTPException(400, "No LLM provider available")

    model = provider.default_model
    logger.info("guide.regenerate.provider | name=%s model=%s", provider.name, model)

    from ..services.llm_base import get_llm_client
    from ..services.renderer import render_guide
    from ..services.prompts import build_prompt
    from ..services.embeddings import get_embedding
    from ..config import settings

    api_key = decrypt_api_key(provider.api_key_encrypted) if provider.api_key_encrypted else None
    client = get_llm_client(provider.provider_type, provider.base_url, api_key)

    slug = guide.document_type.slug if guide.document_type else "rca"
    system_prompt, user_msg = build_prompt(
        doc_type_slug=slug,
        product_name=guide.product.name if guide.product else "",
        customer_name=guide.customer.name if guide.customer else "",
        kcs_subtype=guide.kcs_subtype,
    )

    # --- LLM call (fail loud — don't corrupt the existing guide) ---
    try:
        t_llm = time.perf_counter()
        structured = await client.generate_structured(system_prompt, user_msg + "\n\n" + guide.input_notes, model)
        llm_elapsed = time.perf_counter() - t_llm
        logger.info(
            "guide.regenerate.llm_done | model=%s elapsed=%.2fs sections=%d",
            model, llm_elapsed, len(structured.get("sections", [])),
        )
    except Exception as llm_err:
        elapsed = time.perf_counter() - t_total
        err_type = type(llm_err).__name__
        err_msg = str(llm_err)[:500]
        logger.error("guide.regenerate.llm_failed | guide_id=%d model=%s elapsed=%.2fs error=%s",
                      guide_id, model, elapsed, err_msg, exc_info=True)
        raise HTTPException(502, detail={
            "summary": f"LLM regeneration failed ({err_type})",
            "error_type": err_type,
            "message": err_msg,
            "provider": provider.name,
            "model": model,
            "elapsed_seconds": round(elapsed, 1),
            "hint": _error_hint(llm_err),
        })

    # --- LLM succeeded — update the guide ---
    if structured.get("title"):
        guide.title = structured["title"]

    t_render = time.perf_counter()
    html_content = render_guide(structured, slug, guide.kcs_subtype)
    render_elapsed = time.perf_counter() - t_render
    filename = f"guide_{guide.id}.html"
    html_path = settings.html_dir / filename
    html_path.write_text(html_content, encoding="utf-8")
    guide.html_filename = filename
    guide.provider_id = provider.id
    guide.model_used = model
    guide.status = "generated"
    logger.info("guide.regenerate.rendered | html_size=%d elapsed=%.3fs", len(html_content), render_elapsed)

    t_emb = time.perf_counter()
    try:
        emb = await get_embedding(guide.input_notes)
        emb_elapsed = time.perf_counter() - t_emb
        if emb is not None:
            import numpy as np
            guide.embedding = np.array(emb, dtype=np.float32).tobytes()
            logger.info("guide.regenerate.embedding | dims=%d elapsed=%.2fs", len(emb), emb_elapsed)
        else:
            logger.warning("guide.regenerate.embedding | result=null elapsed=%.2fs", emb_elapsed)
    except Exception as emb_err:
        logger.warning("guide.regenerate.embedding | error=%s", emb_err)

    await db.commit()
    await db.refresh(guide)

    total_elapsed = time.perf_counter() - t_total
    logger.info(
        "guide.regenerate.done | guide_id=%d status=%s total_elapsed=%.2fs",
        guide.id, guide.status, total_elapsed,
    )
    return guide


@router.get("/guides/{guide_id}/token")
async def get_guide_token(guide_id: int, db: AsyncSession = Depends(get_db)):
    guide = await db.get(Guide, guide_id)
    if not guide:
        raise HTTPException(404, "Guide not found")
    return {"access_token": guide.access_token, "public_url": f"/public/guides/{guide.id}"}


@router.post("/guides/{guide_id}/rotate-token")
async def rotate_guide_token(guide_id: int, db: AsyncSession = Depends(get_db)):
    guide = await db.get(Guide, guide_id)
    if not guide:
        raise HTTPException(404, "Guide not found")
    import secrets
    guide.access_token = secrets.token_urlsafe(24)
    await db.commit()
    logger.info("guide.token.rotated | guide_id=%d", guide_id)
    return {"access_token": guide.access_token, "public_url": f"/public/guides/{guide.id}"}


@router.get("/guides/html/{filename}")
async def serve_guide_html(filename: str):
    """Serve a generated guide HTML file directly (admin-only, auth via router dependency)."""
    from ..config import settings
    from starlette.responses import HTMLResponse

    if ".." in filename or "/" in filename:
        raise HTTPException(400, "Invalid filename")
    html_path = settings.html_dir / filename
    if not html_path.exists():
        raise HTTPException(404, "Guide file not found")
    return HTMLResponse(html_path.read_text(encoding="utf-8"))


@router.post("/guides/check-similar", response_model=CheckSimilarResponse)
async def check_similar(data: CheckSimilarRequest, db: AsyncSession = Depends(get_db)):
    t0 = time.perf_counter()
    logger.info("guide.check_similar.start | notes_len=%d", len(data.input_notes))
    from ..services.similarity import find_similar_by_text
    similar = await find_similar_by_text(db, data.input_notes)
    elapsed = time.perf_counter() - t0
    logger.info("guide.check_similar.done | found=%d elapsed=%.2fs", len(similar), elapsed)
    return CheckSimilarResponse(
        has_similar=len(similar) > 0,
        similar_guides=similar,
    )

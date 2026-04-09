import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Guide, Customer, Product, DocumentType
from ..schemas import SimilarGuide, SearchResult
from ..config import settings


def _cosine_similarity(a: bytes, b: bytes) -> float:
    va = np.frombuffer(a, dtype=np.float32)
    vb = np.frombuffer(b, dtype=np.float32)
    dot = np.dot(va, vb)
    na = np.linalg.norm(va)
    nb = np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(dot / (na * nb))


async def find_similar_by_embedding(
    db: AsyncSession,
    embedding_bytes: bytes,
    exclude_id: int | None = None,
    limit: int = 5,
    threshold: float | None = None,
) -> list[SimilarGuide]:
    if threshold is None:
        threshold = settings.similarity_threshold

    result = await db.execute(
        select(Guide).options(
            selectinload(Guide.customer),
            selectinload(Guide.product),
        ).where(Guide.embedding.is_not(None))
    )
    guides = result.scalars().all()

    scored = []
    for g in guides:
        if exclude_id and g.id == exclude_id:
            continue
        sim = _cosine_similarity(embedding_bytes, g.embedding)
        if sim >= threshold:
            scored.append((g, sim))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [
        SimilarGuide(
            id=g.id,
            title=g.title,
            customer_name=g.customer.name if g.customer else "",
            product_name=g.product.name if g.product else "",
            similarity=round(sim, 3),
            touchpoint_date=g.touchpoint_date,
        )
        for g, sim in scored[:limit]
    ]


async def find_similar_by_text(db: AsyncSession, input_text: str) -> list[SimilarGuide]:
    from .embeddings import get_embedding
    emb = await get_embedding(input_text)
    if emb is None:
        return []
    emb_bytes = np.array(emb, dtype=np.float32).tobytes()
    return await find_similar_by_embedding(db, emb_bytes)


async def _fts_search(db: AsyncSession, query: str, limit: int = 20) -> list[SearchResult]:
    try:
        result = await db.execute(
            text(
                "SELECT g.id, g.title, c.name as customer_name, p.name as product_name, "
                "dt.name as document_type_name, g.touchpoint_date, "
                "bm25(guide_fts) as rank "
                "FROM guide_fts fts "
                "JOIN guides g ON g.id = fts.rowid "
                "LEFT JOIN customers c ON c.id = g.customer_id "
                "LEFT JOIN products p ON p.id = g.product_id "
                "LEFT JOIN document_types dt ON dt.id = g.document_type_id "
                "WHERE guide_fts MATCH :query "
                "ORDER BY rank "
                "LIMIT :limit"
            ),
            {"query": query, "limit": limit},
        )
        rows = result.all()
        return [
            SearchResult(
                id=row[0],
                title=row[1],
                customer_name=row[2] or "",
                product_name=row[3] or "",
                document_type_name=row[4] or "",
                touchpoint_date=row[5],
                relevance=round(abs(row[6]), 3) if row[6] else 0.0,
            )
            for row in rows
        ]
    except Exception:
        return []


async def _semantic_search(db: AsyncSession, query: str, limit: int = 20) -> list[SearchResult]:
    from .embeddings import get_embedding
    emb = await get_embedding(query)
    if emb is None:
        return []
    emb_bytes = np.array(emb, dtype=np.float32).tobytes()

    result = await db.execute(
        select(Guide).options(
            selectinload(Guide.customer),
            selectinload(Guide.product),
            selectinload(Guide.document_type),
        ).where(Guide.embedding.is_not(None))
    )
    guides = result.scalars().all()

    scored = []
    for g in guides:
        sim = _cosine_similarity(emb_bytes, g.embedding)
        if sim > 0.3:
            scored.append((g, sim))
    scored.sort(key=lambda x: x[1], reverse=True)

    return [
        SearchResult(
            id=g.id,
            title=g.title,
            customer_name=g.customer.name if g.customer else "",
            product_name=g.product.name if g.product else "",
            document_type_name=g.document_type.name if g.document_type else "",
            touchpoint_date=g.touchpoint_date,
            relevance=round(sim, 3),
        )
        for g, sim in scored[:limit]
    ]


async def search_guides(db: AsyncSession, query: str, mode: str = "combined") -> list[SearchResult]:
    if mode == "keyword":
        return await _fts_search(db, query)
    elif mode == "semantic":
        return await _semantic_search(db, query)
    else:
        kw_results = await _fts_search(db, query)
        sem_results = await _semantic_search(db, query)
        seen = set()
        merged = []
        for r in kw_results + sem_results:
            if r.id not in seen:
                seen.add(r.id)
                merged.append(r)
        merged.sort(key=lambda x: x.relevance, reverse=True)
        return merged[:20]

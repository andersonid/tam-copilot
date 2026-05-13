"""KCS article search endpoints.

Provides access to Red Hat Knowledge Base articles via the Hydra API
for manual browsing and RAG-based content enrichment.
"""

import logging

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("tam_copilot.routers.kcs")

router = APIRouter(prefix="/v1/kcs", tags=["KCS"])


def _get_kcs_service():
    from ..main import _sync_service
    if not _sync_service or not _sync_service.hydra:
        raise HTTPException(503, "KCS search unavailable — Hydra API not configured")
    from ..services.kcs_search import KcsSearchService
    return KcsSearchService(_sync_service.hydra)


@router.get(
    "/search",
    summary="Search KCS articles",
    description="Search Red Hat Knowledge Base articles by keyword and optional product filter.",
)
async def search_kcs(
    q: str = Query(..., min_length=2, description="Search query"),
    product: str = Query(default="", description="Filter by product name"),
    limit: int = Query(default=10, ge=1, le=50, description="Max results"),
):
    svc = _get_kcs_service()
    results = await svc.search(q, product=product, limit=limit)
    return {"query": q, "count": len(results), "articles": results}


@router.get(
    "/articles/{solution_id}",
    summary="Get KCS article",
    description="Fetch a specific KCS article by its solution ID.",
)
async def get_kcs_article(solution_id: str):
    svc = _get_kcs_service()
    article = await svc.get_article(solution_id)
    if not article:
        raise HTTPException(404, f"Article {solution_id} not found")
    return article

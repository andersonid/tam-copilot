from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas import SearchResult

router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[SearchResult])
async def search_guides(
    query: str = Query(min_length=1),
    mode: str = Query(default="combined", pattern=r"^(keyword|semantic|combined)$"),
    db: AsyncSession = Depends(get_db),
):
    from ..services.similarity import search_guides
    return await search_guides(db, query, mode)

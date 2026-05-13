"""KCS article search via Hydra API for RAG-based content enrichment.

Provides semantic search over Red Hat Knowledge Base articles and
formats results as context for LLM prompts.
"""

import logging
from typing import Any

from .hydra_client import HydraClient

logger = logging.getLogger("tam_copilot.kcs_search")

MAX_CONTEXT_ARTICLES = 5
MAX_ARTICLE_LENGTH = 2000


class KcsSearchService:
    """Searches KCS articles via Hydra and prepares context for RAG."""

    def __init__(self, hydra: HydraClient):
        self._hydra = hydra

    async def search(self, query: str, product: str = "", limit: int = 10) -> list[dict]:
        """Search KCS articles by keyword, optionally filtered by product."""
        params: dict[str, Any] = {"keyword": query, "count": limit}
        if product:
            params["product"] = product
        data = await self._hydra._get("/v1/solutions", params=params)
        if isinstance(data, dict) and data.get("error"):
            logger.warning("kcs_search.failed | query=%s", query)
            return []
        items = data if isinstance(data, list) else data.get("items", data.get("solution", []))
        return [_normalize(item) for item in items]

    async def get_article(self, solution_id: str) -> dict | None:
        """Fetch a specific KCS article by ID."""
        data = await self._hydra._get(f"/v1/solutions/{solution_id}")
        if isinstance(data, dict) and data.get("error"):
            return None
        return _normalize(data)

    async def build_rag_context(
        self, query: str, product: str = "", max_articles: int = MAX_CONTEXT_ARTICLES,
    ) -> str:
        """Search KCS and format results as RAG context for LLM prompts.

        Returns a formatted string block containing relevant KCS article
        summaries that can be prepended to user prompts.
        """
        articles = await self.search(query, product=product, limit=max_articles)
        if not articles:
            return ""

        parts = [
            "=== RELEVANT RED HAT KCS ARTICLES (use as reference) ===\n"
        ]
        for i, article in enumerate(articles[:max_articles], 1):
            title = article.get("title", "Untitled")
            abstract = article.get("abstract", "")
            body = article.get("body", "")
            solution_id = article.get("id", "")
            url = article.get("url", "")

            content = abstract or body
            if len(content) > MAX_ARTICLE_LENGTH:
                content = content[:MAX_ARTICLE_LENGTH] + "..."

            parts.append(f"--- KCS Article {i}: {title} ---")
            if solution_id:
                parts.append(f"ID: {solution_id}")
            if url:
                parts.append(f"URL: {url}")
            if content:
                parts.append(f"Content: {content}")
            parts.append("")

        parts.append("=== END KCS CONTEXT ===\n")
        context = "\n".join(parts)
        logger.info("rag_context | query=%s articles=%d chars=%d", query, len(articles), len(context))
        return context


def _normalize(raw: dict) -> dict:
    """Normalize KCS article fields from varying Hydra response formats."""
    return {
        "id": raw.get("id", raw.get("solution_id", raw.get("caseNumber", ""))),
        "title": raw.get("title", raw.get("summary", "")),
        "abstract": raw.get("abstract", raw.get("description", "")),
        "body": raw.get("body", raw.get("resolution", {}).get("text", "") if isinstance(raw.get("resolution"), dict) else ""),
        "url": raw.get("view_uri", raw.get("url", "")),
        "product": raw.get("product", {}).get("name", "") if isinstance(raw.get("product"), dict) else raw.get("product", ""),
        "created_date": raw.get("created_date", raw.get("createdDate", "")),
        "modified_date": raw.get("last_modified_date", raw.get("modifiedDate", "")),
    }

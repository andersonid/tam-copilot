import logging
import time

from openai import AsyncOpenAI
from ..config import settings

logger = logging.getLogger("tam_copilot.embeddings")


async def get_embedding(text: str) -> list[float] | None:
    """Get embedding vector for text using the default embedding model via LiteMaaS."""
    truncated = text[:8000]
    logger.info(
        "embedding.start | model=%s text_len=%d truncated_len=%d",
        settings.embedding_model, len(text), len(truncated),
    )
    t0 = time.perf_counter()
    try:
        client = AsyncOpenAI(
            base_url=settings.default_provider_base_url,
            api_key=settings.default_provider_api_key,
        )
        resp = await client.embeddings.create(
            model=settings.embedding_model,
            input=truncated,
            encoding_format="float",
        )
        elapsed = time.perf_counter() - t0
        dims = len(resp.data[0].embedding)
        usage = resp.usage
        logger.info(
            "embedding.done | model=%s dims=%d elapsed=%.2fs prompt_tokens=%s total_tokens=%s",
            settings.embedding_model, dims, elapsed,
            usage.prompt_tokens if usage else "?",
            usage.total_tokens if usage else "?",
        )
        return resp.data[0].embedding
    except Exception as e:
        elapsed = time.perf_counter() - t0
        logger.error("embedding.fail | model=%s elapsed=%.2fs error=%s", settings.embedding_model, elapsed, e)
        return None

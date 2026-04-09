from openai import AsyncOpenAI
from ..config import settings


async def get_embedding(text: str) -> list[float] | None:
    """Get embedding vector for text using the default embedding model via LiteMaaS."""
    try:
        client = AsyncOpenAI(
            base_url=settings.default_provider_base_url,
            api_key=settings.default_provider_api_key,
        )
        resp = await client.embeddings.create(
            model=settings.embedding_model,
            input=text[:8000],
            encoding_format="float",
        )
        return resp.data[0].embedding
    except Exception:
        return None

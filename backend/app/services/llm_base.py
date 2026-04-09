import logging
from typing import Protocol, runtime_checkable

logger = logging.getLogger("tam_copilot.llm")


@runtime_checkable
class LLMClient(Protocol):
    async def generate_structured(self, system_prompt: str, user_message: str, model: str) -> dict: ...
    async def test_connection(self, model: str) -> bool: ...
    async def list_models(self) -> list[str]: ...


def get_llm_client(provider_type: str, base_url: str | None, api_key: str | None) -> LLMClient:
    logger.info("llm_client.create | type=%s base_url=%s", provider_type, base_url)
    match provider_type:
        case "openai_compatible":
            from .llm_openai import OpenAICompatibleClient
            return OpenAICompatibleClient(base_url=base_url or "https://api.openai.com/v1", api_key=api_key or "")
        case "anthropic":
            from .llm_anthropic import AnthropicClient
            return AnthropicClient(api_key=api_key or "")
        case "google_gemini":
            from .llm_gemini import GeminiClient
            return GeminiClient(api_key=api_key or "")
        case _:
            logger.error("llm_client.unknown_type | type=%s", provider_type)
            raise ValueError(f"Unknown provider type: {provider_type}")

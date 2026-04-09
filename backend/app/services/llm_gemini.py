import json
import logging
import time

from google import genai

logger = logging.getLogger("tam_copilot.llm.gemini")


class GeminiClient:
    def __init__(self, api_key: str):
        self._client = genai.Client(api_key=api_key)

    async def generate_structured(self, system_prompt: str, user_message: str, model: str) -> dict:
        logger.info(
            "gemini.chat.start | model=%s prompt_len=%d",
            model, len(system_prompt) + len(user_message),
        )
        t0 = time.perf_counter()
        response = self._client.models.generate_content(
            model=model,
            contents=f"{system_prompt}\n\n{user_message}",
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=4096,
            ),
        )
        elapsed = time.perf_counter() - t0
        content = response.text or "{}"
        usage = getattr(response, "usage_metadata", None)
        logger.info(
            "gemini.chat.done | model=%s elapsed=%.2fs response_len=%d "
            "prompt_tokens=%s candidates_tokens=%s",
            model, elapsed, len(content),
            getattr(usage, "prompt_token_count", "?") if usage else "?",
            getattr(usage, "candidates_token_count", "?") if usage else "?",
        )
        return json.loads(content)

    async def test_connection(self, model: str) -> bool:
        logger.info("gemini.test | model=%s", model)
        response = self._client.models.generate_content(
            model=model,
            contents="Respond with: ok",
            config=genai.types.GenerateContentConfig(max_output_tokens=5),
        )
        ok = bool(response.text)
        logger.info("gemini.test.result | model=%s success=%s", model, ok)
        return ok

    async def list_models(self) -> list[str]:
        return [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ]

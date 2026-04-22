import json
import logging
import time

from openai import AsyncOpenAI

logger = logging.getLogger("tam_copilot.llm.openai")


class OpenAICompatibleClient:
    def __init__(self, base_url: str, api_key: str):
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=180.0)
        self._base_url = base_url

    async def generate_structured(self, system_prompt: str, user_message: str, model: str) -> dict:
        logger.info(
            "openai.chat.start | model=%s base_url=%s system_len=%d user_len=%d",
            model, self._base_url, len(system_prompt), len(user_message),
        )
        t0 = time.perf_counter()
        resp = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=4096,
        )
        elapsed = time.perf_counter() - t0
        content = resp.choices[0].message.content or "{}"
        usage = resp.usage
        logger.info(
            "openai.chat.done | model=%s elapsed=%.2fs response_len=%d "
            "prompt_tokens=%s completion_tokens=%s total_tokens=%s finish_reason=%s",
            model, elapsed, len(content),
            usage.prompt_tokens if usage else "?",
            usage.completion_tokens if usage else "?",
            usage.total_tokens if usage else "?",
            resp.choices[0].finish_reason,
        )
        return json.loads(content)

    async def test_connection(self, model: str) -> bool:
        logger.info("openai.test | model=%s base_url=%s", model, self._base_url)
        resp = await self._client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Respond with: ok"}],
            max_tokens=5,
        )
        ok = bool(resp.choices)
        logger.info("openai.test.result | model=%s success=%s", model, ok)
        return ok

    async def list_models(self) -> list[str]:
        logger.info("openai.list_models | base_url=%s", self._base_url)
        try:
            models = await self._client.models.list()
            ids = [m.id for m in models.data]
            logger.info("openai.list_models.done | count=%d", len(ids))
            return ids
        except Exception as e:
            logger.warning("openai.list_models.fail | error=%s", e)
            return []

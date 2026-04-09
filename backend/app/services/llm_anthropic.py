import json
import logging
import time

from anthropic import AsyncAnthropic

logger = logging.getLogger("tam_copilot.llm.anthropic")


class AnthropicClient:
    def __init__(self, api_key: str):
        self._client = AsyncAnthropic(api_key=api_key)

    async def generate_structured(self, system_prompt: str, user_message: str, model: str) -> dict:
        logger.info(
            "anthropic.chat.start | model=%s system_len=%d user_len=%d",
            model, len(system_prompt), len(user_message),
        )
        t0 = time.perf_counter()
        resp = await self._client.messages.create(
            model=model,
            system=system_prompt + "\n\nYou MUST respond with valid JSON only, no other text.",
            messages=[{"role": "user", "content": user_message}],
            max_tokens=4096,
            temperature=0.3,
        )
        elapsed = time.perf_counter() - t0
        content = resp.content[0].text if resp.content else "{}"
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if len(lines) > 2 else content
        logger.info(
            "anthropic.chat.done | model=%s elapsed=%.2fs response_len=%d "
            "input_tokens=%s output_tokens=%s stop_reason=%s",
            model, elapsed, len(content),
            resp.usage.input_tokens if resp.usage else "?",
            resp.usage.output_tokens if resp.usage else "?",
            resp.stop_reason,
        )
        return json.loads(content)

    async def test_connection(self, model: str) -> bool:
        logger.info("anthropic.test | model=%s", model)
        resp = await self._client.messages.create(
            model=model,
            messages=[{"role": "user", "content": "Respond with: ok"}],
            max_tokens=5,
        )
        ok = bool(resp.content)
        logger.info("anthropic.test.result | model=%s success=%s", model, ok)
        return ok

    async def list_models(self) -> list[str]:
        return [
            "claude-sonnet-4-20250514",
            "claude-3-5-haiku-20241022",
            "claude-3-5-sonnet-20241022",
        ]

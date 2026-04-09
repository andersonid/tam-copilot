import json
from anthropic import AsyncAnthropic


class AnthropicClient:
    def __init__(self, api_key: str):
        self._client = AsyncAnthropic(api_key=api_key)

    async def generate_structured(self, system_prompt: str, user_message: str, model: str) -> dict:
        resp = await self._client.messages.create(
            model=model,
            system=system_prompt + "\n\nYou MUST respond with valid JSON only, no other text.",
            messages=[{"role": "user", "content": user_message}],
            max_tokens=4096,
            temperature=0.3,
        )
        content = resp.content[0].text if resp.content else "{}"
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if len(lines) > 2 else content
        return json.loads(content)

    async def test_connection(self, model: str) -> bool:
        resp = await self._client.messages.create(
            model=model,
            messages=[{"role": "user", "content": "Respond with: ok"}],
            max_tokens=5,
        )
        return bool(resp.content)

    async def list_models(self) -> list[str]:
        return [
            "claude-sonnet-4-20250514",
            "claude-3-5-haiku-20241022",
            "claude-3-5-sonnet-20241022",
        ]

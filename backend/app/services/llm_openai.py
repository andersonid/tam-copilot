import json
from openai import AsyncOpenAI


class OpenAICompatibleClient:
    def __init__(self, base_url: str, api_key: str):
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    async def generate_structured(self, system_prompt: str, user_message: str, model: str) -> dict:
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
        content = resp.choices[0].message.content or "{}"
        return json.loads(content)

    async def test_connection(self, model: str) -> bool:
        resp = await self._client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Respond with: ok"}],
            max_tokens=5,
        )
        return bool(resp.choices)

    async def list_models(self) -> list[str]:
        try:
            models = await self._client.models.list()
            return [m.id for m in models.data]
        except Exception:
            return []

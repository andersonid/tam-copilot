import json
from google import genai


class GeminiClient:
    def __init__(self, api_key: str):
        self._client = genai.Client(api_key=api_key)

    async def generate_structured(self, system_prompt: str, user_message: str, model: str) -> dict:
        response = self._client.models.generate_content(
            model=model,
            contents=f"{system_prompt}\n\n{user_message}",
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=4096,
            ),
        )
        content = response.text or "{}"
        return json.loads(content)

    async def test_connection(self, model: str) -> bool:
        response = self._client.models.generate_content(
            model=model,
            contents="Respond with: ok",
            config=genai.types.GenerateContentConfig(max_output_tokens=5),
        )
        return bool(response.text)

    async def list_models(self) -> list[str]:
        return [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ]

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./data/tam_copilot.db"
    data_dir: str = "./data"
    secret_key: str = "change-me-in-production"
    static_dir: str = "./static"

    default_provider_name: str = "LiteMaaS"
    default_provider_type: str = "openai_compatible"
    default_provider_base_url: str = "https://litellm-prod.apps.maas.redhatworkshops.io"
    default_provider_api_key: str = ""
    default_provider_model: str = "qwen3-14b"

    embedding_model: str = "nomic-embed-text-v1-5"
    similarity_threshold: float = 0.82

    @property
    def html_dir(self) -> Path:
        p = Path(self.data_dir) / "html"
        p.mkdir(parents=True, exist_ok=True)
        return p

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

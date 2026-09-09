from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        # Coolify injects blank keys (EMBEDDING_DIMENSIONS=). Treat as unset.
        env_ignore_empty=True,
    )

    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""

    embedding_base_url: str = ""
    embedding_api_key: str = ""
    embedding_model: str = ""
    embedding_dimensions: int | None = None
    vision_model: str = ""

    database_path: Path = Path("./data/dossier.db")
    cors_origin: str = "http://localhost:3000"
    log_level: str = "INFO"

    files_dir: Path = Field(default=Path("./data/files"))
    auto_seed: bool = True

    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_name: str = ""

    # Self-hosted default is free. Set these to list prices if you switch to OpenAI.
    price_embed_per_1m: float = 0.0
    price_llm_in_per_1m: float = 0.0
    price_llm_out_per_1m: float = 0.0

    def resolved_embedding_base_url(self) -> str:
        return self.embedding_base_url or self.llm_base_url

    def resolved_embedding_api_key(self) -> str:
        return self.embedding_api_key or self.llm_api_key

    def resolved_vision_model(self) -> str:
        return self.vision_model or self.llm_model

    def cors_origins(self) -> list[str]:
        return [part.strip() for part in self.cors_origin.split(",") if part.strip()]


# Desk opened via a LAN IP (http://192.168.x.x:3000) is still local.
LAN_UI_ORIGIN = (
    r"https?://(localhost|127\.0\.0\.1|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
    r"):3000$"
)


def get_settings() -> Settings:
    return Settings()

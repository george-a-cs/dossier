import re

from dossier.config import LAN_UI_ORIGIN, Settings


def test_defaults_when_env_empty(monkeypatch) -> None:
    for key in (
        "LLM_BASE_URL",
        "LLM_API_KEY",
        "LLM_MODEL",
        "EMBEDDING_BASE_URL",
        "EMBEDDING_API_KEY",
        "EMBEDDING_MODEL",
        "DATABASE_PATH",
        "CORS_ORIGIN",
    ):
        monkeypatch.delenv(key, raising=False)

    settings = Settings(_env_file=None)
    assert settings.llm_base_url == ""
    assert settings.llm_api_key == ""
    assert settings.llm_model == ""
    assert settings.bootstrap_admin_email == ""
    assert settings.bootstrap_admin_password == ""
    assert settings.resolved_embedding_base_url() == settings.llm_base_url
    assert settings.resolved_embedding_api_key() == ""
    assert settings.cors_origin == "http://localhost:3000"
    assert settings.cors_origins() == ["http://localhost:3000"]


def test_embedding_falls_back_to_llm(monkeypatch) -> None:
    monkeypatch.setenv("LLM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("LLM_API_KEY", "secret")
    monkeypatch.delenv("EMBEDDING_BASE_URL", raising=False)
    monkeypatch.delenv("EMBEDDING_API_KEY", raising=False)
    settings = Settings(_env_file=None)
    assert settings.resolved_embedding_base_url() == "https://example.test/v1"
    assert settings.resolved_embedding_api_key() == "secret"


def test_vision_model_falls_back_to_llm(monkeypatch) -> None:
    monkeypatch.setenv("LLM_MODEL", "researcher-internal")
    monkeypatch.delenv("VISION_MODEL", raising=False)
    settings = Settings(_env_file=None)
    assert settings.resolved_vision_model() == "researcher-internal"
    monkeypatch.setenv("VISION_MODEL", "vision-docs-reasoning")
    settings = Settings(_env_file=None)
    assert settings.resolved_vision_model() == "vision-docs-reasoning"


def test_cors_origin_is_comma_list(monkeypatch) -> None:
    monkeypatch.setenv(
        "CORS_ORIGIN", "http://localhost:3000, http://127.0.0.1:3000"
    )
    settings = Settings(_env_file=None)
    assert settings.cors_origins() == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def test_blank_coolify_env_uses_defaults(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_DIMENSIONS", "")
    monkeypatch.setenv("EMBEDDING_MODEL", "")
    monkeypatch.setenv("PRICE_EMBED_PER_1M", "")
    monkeypatch.setenv("PRICE_LLM_IN_PER_1M", "")
    monkeypatch.setenv("PRICE_LLM_OUT_PER_1M", "")
    settings = Settings(_env_file=None)
    assert settings.embedding_dimensions is None
    assert settings.embedding_model == ""
    assert settings.price_embed_per_1m == 0.0
    assert settings.price_llm_in_per_1m == 0.0
    assert settings.price_llm_out_per_1m == 0.0


def test_lan_ui_origin_regex() -> None:
    allowed = re.compile(LAN_UI_ORIGIN)
    assert allowed.match("http://192.168.0.220:3000")
    assert allowed.match("http://localhost:3000")
    assert not allowed.match("https://evil.example:3000")

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    app_env: str = "development"
    allowed_origins: str = "http://localhost:3000"
    dev_provider_id: str | None = None
    frontend_url: str = "http://localhost:5173"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    paypal_client_id: str | None = None
    paypal_client_secret: str | None = None
    paypal_env: str = "sandbox"
    paypal_sandbox_buyer_email: str | None = None
    backend_url: str = "http://localhost:8000"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True
    google_client_id: str | None = None
    google_client_secret: str | None = None
    facebook_client_id: str | None = None
    facebook_client_secret: str | None = None
    openai_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

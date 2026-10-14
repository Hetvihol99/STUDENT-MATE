from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Literal
from pydantic import Field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # AI
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"

    # App
    app_env: str = "development"
    auth_mode: Literal["session", "development"] = "session"
    session_days: int = Field(default=7, ge=1, le=30)
    dev_user_id: str = "dev_student_001"
    dev_user_name: str = "Dev Student"

    # Storage
    database_path: str = ".local-data/studymate.db"
    storage_path: str = ".local-data/files"

    # Limits
    max_upload_mb: int = 5
    max_video_mb: int = 50
    max_video_minutes: int = 60
    video_timeout_seconds: int = 180
    max_pdf_pages: int = 25
    max_text_chars: int = 80_000

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # Rate limits (per hour per user)
    rate_limit_upload: int = 10
    rate_limit_chat: int = 30
    rate_limit_quiz: int = 20
    rate_limit_seed: int = 10

    @property
    def ai_available(self) -> bool:
        return bool(self.gemini_api_key and self.gemini_model)

    @property
    def allowed_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
for field in ("database_path", "storage_path"):
    path = Path(getattr(settings, field))
    if not path.is_absolute():
        setattr(settings, field, str(BACKEND_DIR / path))

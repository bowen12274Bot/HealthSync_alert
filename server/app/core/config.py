from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_env: str
    app_host: str
    app_port: int
    database_url: str
    seed_user_email: str
    seed_user_password: str


def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "HealthSync Alert API"),
        app_env=os.getenv("APP_ENV", "development"),
        app_host=os.getenv("APP_HOST", "127.0.0.1"),
        app_port=int(os.getenv("APP_PORT", "8000")),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://healthsync_user:healthsync_password@127.0.0.1:5432/healthsync_alert",
        ),
        seed_user_email=os.getenv("SEED_USER_EMAIL", ""),
        seed_user_password=os.getenv("SEED_USER_PASSWORD", ""),
    )


settings = get_settings()

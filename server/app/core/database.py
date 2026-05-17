import importlib
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.base import Base


engine = create_engine(settings.database_url, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def load_model_modules() -> None:
    # Load model modules so SQLAlchemy metadata is populated before create/drop runs.
    importlib.import_module("app.models.auth_token")
    importlib.import_module("app.models.health_check_record")
    importlib.import_module("app.models.user_account")


def create_db_tables() -> None:
    load_model_modules()
    Base.metadata.create_all(bind=engine)


def drop_db_tables() -> None:
    load_model_modules()
    Base.metadata.drop_all(bind=engine)


def reset_db_tables() -> None:
    drop_db_tables()
    create_db_tables()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

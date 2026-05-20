import importlib
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.base import Base


engine = create_engine(settings.database_url, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def load_model_modules() -> None:
    # Import the models package once so all table mappings are registered in one place.
    importlib.import_module("app.models")


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

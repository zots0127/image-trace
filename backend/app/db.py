from contextlib import contextmanager
from typing import Iterator
import os
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./image_trace.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)


def init_db() -> None:
    """Create database tables for the MVP."""
    from . import models  # noqa: F401  # ensure models are imported

    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


def get_database_dialect() -> str:
    return engine.dialect.name


def get_database_size(session: Session) -> int:
    try:
        dialect = get_database_dialect()
        if dialect == "sqlite":
            db_path = engine.url.database or ""
            if db_path:
                try:
                    return Path(db_path).stat().st_size
                except Exception:
                    if os.path.exists(db_path):
                        return os.path.getsize(db_path)
            return 0
        if dialect == "postgresql":
            result = session.exec(text("SELECT pg_database_size(current_database())")).first()
            if result is None:
                return 0
            return int(result[0]) if isinstance(result, tuple) else int(result)
        if dialect == "mysql":
            result = session.exec(text("SELECT SUM(data_length + index_length) FROM information_schema.tables WHERE table_schema = DATABASE()"))
            row = result.first()
            if row is None:
                return 0
            return int(row[0]) if isinstance(row, tuple) else int(row)
        return 0
    except Exception:
        return 0

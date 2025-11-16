from contextlib import contextmanager
from typing import Iterator

from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = "sqlite:///./image_trace.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)


def init_db() -> None:
    """Create database tables for the MVP."""
    from . import models  # noqa: F401  # ensure models are imported

    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session

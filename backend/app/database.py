"""SQLAlchemy engine, session factory and declarative base."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Enforce the session pooler port (5432) instead of transaction pooler (6543) if present
if ":6543" in db_url:
    db_url = db_url.replace(":6543", ":5432")

from sqlalchemy.pool import NullPool

# Database session pooling configuration
engine_kwargs = {
    "pool_pre_ping": True,
    "future": True,
}

# SQLite does not support pool_size or max_overflow arguments
if not db_url.startswith("sqlite"):
    engine_kwargs.update({
        "poolclass": NullPool,
        "connect_args": {
            "connect_timeout": 5,
            "options": "-c statement_timeout=5000",
        },
    })

engine = create_engine(db_url, **engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

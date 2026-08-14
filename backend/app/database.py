"""SQLAlchemy engine, session factory and declarative base.

Connection pooling is tuned for a shared-host deployment (Render Web Service)
talking to Supabase. Supabase's connection pooler (Supavisor) handles the real
pooling at the database side; SQLAlchemy just needs a modest client-side pool
large enough to absorb concurrent dashboard polling + SSE streams.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

db_url = settings.database_url
# Normalize legacy schemes to the psycopg 3 driver SQLAlchemy expects.
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)


engine_kwargs: dict = {
    "pool_pre_ping": True,   # verify a connection is alive before handing it out
    "future": True,
}

# SQLite (tests) doesn't understand pool sizing arguments.
if not db_url.startswith("sqlite"):
    engine_kwargs.update(
        {
            # Enough for the dashboard's parallel polling + a few SSE streams
            # without overwhelming Supabase's per-project connection limit.
            "pool_size": 10,
            "max_overflow": 10,
            "pool_timeout": 30,       # wait up to 30s for a free connection
            "pool_recycle": 1800,     # recycle every 30 min to dodge idle drops
            "connect_args": {
                "connect_timeout": 10,
                # 15s server-side statement timeout: prevents a slow query
                # from monopolizing a pool connection.
                "options": "-c statement_timeout=15000",
            },
        }
    )

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

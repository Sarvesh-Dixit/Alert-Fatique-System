"""Create all database tables.

Phase 1 uses SQLAlchemy ``create_all`` for a frictionless local setup. The
models are structured so a Phase 2 migration tool (Alembic) can be introduced
without changing the schema. Run with:  python -m app.db_init
"""
from app.database import Base, engine
from app import models  # noqa: F401  (registers all tables on Base.metadata)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database tables created.")

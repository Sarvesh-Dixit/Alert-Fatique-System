"""FastAPI application factory for the Telemetry Highway gateway."""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1 import (
    admin,
    agent,
    analytics,
    applications,
    auth,
    demo,
    devices,
    explorer,
    incidents,
    organizations,
    telemetry,
)
from app.config import settings

log = logging.getLogger("telemetry.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Best-effort bootstrap so the stack "just works" locally.
    try:
        from app.db_init import init_db

        init_db()
    except Exception:  # noqa: BLE001
        log.exception("DB init failed on startup (continuing; check DATABASE_URL)")
    try:
        from app.core.redis_client import ensure_consumer_group

        ensure_consumer_group()
    except Exception:  # noqa: BLE001
        log.warning("Could not ensure Redis consumer group on startup")
    yield


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description="Secure multi-tenant telemetry gateway, intelligence engine, "
    "OS agents, notifications, RBAC, and analytics (Phase 3).",
    lifespan=lifespan,
)

# Parse, normalize, and sanitize CORS origins
default_origins = [
    "https://alert-fatique-system.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

_cors_origins: list[str] = list(default_origins)
if hasattr(settings, "cors_origins") and settings.cors_origins:
    raw = settings.cors_origins
    if isinstance(raw, str):
        raw = raw.strip()
        if raw.startswith("[") and raw.endswith("]"):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    _cors_origins.extend([str(o).strip().rstrip("/") for o in parsed if str(o).strip()])
            except Exception:
                pass
        else:
            _cors_origins.extend([o.strip().rstrip("/") for o in raw.split(",") if o.strip()])
    elif isinstance(raw, list):
        _cors_origins.extend([str(o).strip().rstrip("/") for o in raw if str(o).strip()])

# Deduplicate origins while preserving order
origins = [o for i, o in enumerate(_cors_origins) if o and o not in _cors_origins[:i]]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Matches all Vercel domains and preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

API_V1 = "/api/v1"
app.include_router(auth.router, prefix=API_V1)
app.include_router(organizations.router, prefix=API_V1)
app.include_router(applications.router, prefix=API_V1)
app.include_router(explorer.router, prefix=API_V1)
app.include_router(devices.router, prefix=API_V1)
app.include_router(telemetry.router, prefix=API_V1)
app.include_router(incidents.router, prefix=API_V1)
app.include_router(demo.router, prefix=API_V1)
app.include_router(agent.router, prefix=API_V1)
app.include_router(admin.router, prefix=API_V1)
app.include_router(analytics.router, prefix=API_V1)


@app.get("/healthz", tags=["system"])
def healthz():
    return {"status": "ok"}


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "service": settings.app_name, "version": __version__}


@app.get("/", tags=["system"])
def root():
    return {"service": settings.app_name, "docs": "/docs", "health": "/health"}

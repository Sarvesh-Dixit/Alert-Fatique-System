"""Dashboard user authentication + registration."""
from __future__ import annotations

import re
import logging
from sqlalchemy.exc import IntegrityError
from fastapi.concurrency import run_in_threadpool

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.audit import record_audit
from app.core.ids import new_id
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.integration import RetentionPolicy
from app.models.organization import Organization, OrganizationMember
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MeResponse,
    OrganizationResponse,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "org"
    return f"{base}-{new_id('')[1:9]}"


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    org = Organization(name=payload.organization_name, slug=_slugify(payload.organization_name))
    db.add_all([user, org])
    db.flush()

    db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="owner"))
    # Seed an explicit retention policy for the org rather than relying on
    # lazy creation the first time an admin visits the retention page.
    db.add(
        RetentionPolicy(
            organization_id=org.id,
            raw_telemetry_days=settings.retention_raw_telemetry_days,
            incident_days=settings.retention_incident_days,
            audit_days=settings.retention_audit_days,
        )
    )
    record_audit(
        db,
        action="user.register",
        organization_id=org.id,
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        commit=False,
    )
    db.commit()

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        # Record failed authentication (no password) for the security dashboard.
        record_audit(
            db,
            action="user.login_failed",
            user_id=user.id if user else None,
            ip_address=request.client.host if request.client else None,
            metadata={"email": payload.email.lower()},
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    record_audit(
        db,
        action="user.login",
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
    )
    return TokenResponse(access_token=create_access_token(user.id))


logger = logging.getLogger("telemetry.auth")


@router.post("/guest", response_model=TokenResponse)
async def guest_login(request: Request, db: Session = Depends(get_db)):
    logger.info("Guest login attempt...")

    def _get_or_create_guest():
        email = "evaluator@telemetryhighway.com"
        # Try to resolve guest user first
        user = db.scalar(select(User).where(User.email == email))
        if user:
            logger.info("Resolved existing guest evaluator user")
            return TokenResponse(access_token=create_access_token(user.id))

        # Create guest user, org, and seed data
        try:
            user = User(
                email=email,
                full_name="Guest Evaluator",
                hashed_password=hash_password("evaluatorpass"),
            )
            org = Organization(name="Evaluator Organization", slug=_slugify("Evaluator Organization"))
            db.add_all([user, org])
            db.flush()

            db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="owner"))
            db.add(
                RetentionPolicy(
                    organization_id=org.id,
                    raw_telemetry_days=settings.retention_raw_telemetry_days,
                    incident_days=settings.retention_incident_days,
                    audit_days=settings.retention_audit_days,
                )
            )
            record_audit(
                db,
                action="user.register",
                organization_id=org.id,
                user_id=user.id,
                ip_address=request.client.host if request.client else None,
                commit=False,
            )
            db.commit()
            logger.info("Guest evaluator user and organization created successfully")
        except IntegrityError:
            db.rollback()
            # If a concurrent request inserted the user, query again
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                logger.error("Failed to resolve guest user after registration conflict")
                raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to resolve guest user")
            logger.info("Guest evaluator resolved after concurrent registration conflict")

        return TokenResponse(access_token=create_access_token(user.id))

    try:
        return await run_in_threadpool(_get_or_create_guest)
    except Exception as e:
        logger.error(f"Error in guest login: {e}")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Database error during guest login: {e}"
        )


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.scalars(
        select(OrganizationMember).where(OrganizationMember.user_id == user.id)
    ).all()
    orgs = []
    for m in memberships:
        org = db.get(Organization, m.organization_id)
        if org:
            orgs.append(
                OrganizationResponse(id=org.id, name=org.name, slug=org.slug, role=m.role)
            )
    return MeResponse(user=UserResponse.model_validate(user), organizations=orgs)

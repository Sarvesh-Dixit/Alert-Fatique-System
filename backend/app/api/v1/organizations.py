"""Organization listing/creation for the current user."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.ids import new_id
from app.database import get_db
from app.models.organization import Organization, OrganizationMember
from app.models.user import User
from app.schemas.auth import OrganizationResponse

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "org"
    return f"{base}-{new_id('')[1:9]}"


@router.get("", response_model=list[OrganizationResponse])
def list_organizations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.scalars(
        select(OrganizationMember).where(OrganizationMember.user_id == user.id)
    ).all()
    out: list[OrganizationResponse] = []
    for m in memberships:
        org = db.get(Organization, m.organization_id)
        if org:
            out.append(
                OrganizationResponse(id=org.id, name=org.name, slug=org.slug, role=m.role)
            )
    return out


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = Organization(name=name, slug=_slugify(name))
    db.add(org)
    db.flush()
    db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="owner"))
    db.commit()
    return OrganizationResponse(id=org.id, name=org.name, slug=org.slug, role="owner")

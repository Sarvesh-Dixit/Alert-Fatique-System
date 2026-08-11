"""Retention housekeeping: purge expired data per each org's policy.

Run periodically (cron / scheduled task):  python -m app.worker.housekeeping
"""
from __future__ import annotations

import logging

from sqlalchemy import select

from app.core.retention import purge_organization
from app.database import SessionLocal
from app.models.organization import Organization

logging.basicConfig(level=logging.INFO, format="%(asctime)s [housekeeping] %(levelname)s %(message)s")
log = logging.getLogger("telemetry.housekeeping")


def run_once() -> dict:
    db = SessionLocal()
    totals = {"raw_telemetry_deleted": 0, "incidents_deleted": 0, "audit_deleted": 0}
    try:
        org_ids = db.scalars(select(Organization.id)).all()
        for org_id in org_ids:
            result = purge_organization(db, org_id)
            for k in totals:
                totals[k] += result[k]
            if any(result.values()):
                log.info("purged org %s: %s", org_id, result)
    finally:
        db.close()
    return totals


if __name__ == "__main__":
    log.info("Retention purge complete: %s", run_once())

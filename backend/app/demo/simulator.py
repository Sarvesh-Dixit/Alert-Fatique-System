from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.ids import new_id
from app.models.application import Application
from app.models.incident import ErrorGroup, Incident
from app.worker.processor import process_event

DATASET_PATH = os.path.join(os.path.dirname(__file__), "datasets", "loghub_hdfs.json")


def run_loghub_simulation(
    db: Session,
    organization_id: str,
    count: int,
    noise_factor: int,
    apps_count: int,
) -> dict:
    # 1. Ensure demo applications exist
    from app.api.v1.demo import _ensure_demo_apps
    demo_apps = _ensure_demo_apps(db, organization_id, apps_count)

    # 2. Load dataset
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"LogHub HDFS dataset not found at {DATASET_PATH}")

    with open(DATASET_PATH) as f:
        dataset = json.load(f)

    # 3. Track state to identify newly created groups and incidents during this run
    pre_existing_group_ids = set(db.scalars(
        select(ErrorGroup.id).where(ErrorGroup.organization_id == organization_id)
    ).all())
    pre_existing_incident_ids = set(db.scalars(
        select(Incident.id).where(Incident.organization_id == organization_id)
    ).all())

    # We will generate a base time that increments slightly for each log to simulate real-world streaming
    start_time = datetime.now(timezone.utc)
    events_to_process = []

    for idx in range(count):
        # Sample or cycle through the dataset
        base_log = dataset[idx % len(dataset)]
        app = demo_apps[idx % len(demo_apps)]

        # Apply noise_factor multiplier (duplicates)
        for n in range(noise_factor):
            timestamp = start_time
            now_str = timestamp.isoformat()
            
            events_to_process.append({
                "event_id": new_id("evt"),
                "organization_id": organization_id,
                "application_id": app.id,
                "service": base_log["service"],
                "source_type": "application",
                "environment": "production",
                "region": app.region or "india",
                "event_type": base_log.get("event_type", "log"),
                "severity": base_log["severity"],
                "message": base_log["message"],
                "timestamp": now_str,
                "received_at": now_str,
                "metadata": dict(base_log.get("metadata", {})),
            })

    total_raw_events = len(events_to_process)

    # 4. Stream events through the ingestion proxy gateway
    for ev in events_to_process:
        process_event(db, ev, commit=False)

    db.flush()

    # Query groups and incidents after ingestion
    post_group_ids = set(db.scalars(
        select(ErrorGroup.id).where(ErrorGroup.organization_id == organization_id)
    ).all())
    post_incident_ids = set(db.scalars(
        select(Incident.id).where(Incident.organization_id == organization_id)
    ).all())

    new_group_ids = post_group_ids - pre_existing_group_ids
    new_incident_ids = post_incident_ids - pre_existing_incident_ids

    incidents_count = len(new_incident_ids)

    # Fetch number of notifications sent for these new incidents
    notifications_sent = 0
    if new_incident_ids:
        notifications_sent = db.scalar(
            select(func.sum(Incident.notifications_sent))
            .where(Incident.id.in_(list(new_incident_ids)))
        ) or 0

    # Noise Reduction Ratio (NRR) at notification level
    nrr = 1.0 - (notifications_sent / max(total_raw_events, 1))

    # Commit the transaction
    db.commit()

    return {
        "total_raw_events": total_raw_events,
        "generated_embeddings": total_raw_events,
        "grouped_error_instances": len(new_group_ids),
        "resulting_incidents_created": incidents_count,
        "noise_reduction_ratio": round(nrr, 4),
    }

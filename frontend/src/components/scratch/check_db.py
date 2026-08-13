import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from app.database import SessionLocal
from app.models.incident import Incident
from app.config import settings
from datetime import datetime, timezone

db = SessionLocal()
try:
    incidents = db.query(Incident).filter(Incident.status == "OPEN", Incident.last_notified_at != None).all()
    print(f"Total open cooldown incidents in DB: {len(incidents)}")
    now = datetime.now(timezone.utc)
    for inc in incidents:
        last_notified = inc.last_notified_at
        if last_notified.tzinfo is None:
            last_notified = last_notified.replace(tzinfo=timezone.utc)
        cooldown_sec = settings.cooldown_for(inc.severity)
        elapsed = (now - last_notified).total_seconds()
        remaining = max(0, int(cooldown_sec - elapsed))
        print(f"ID: {inc.id} | Title: {inc.title} | Severity: {inc.severity} | Remaining: {remaining}s")
finally:
    db.close()

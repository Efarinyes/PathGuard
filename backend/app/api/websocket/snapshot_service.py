from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.models.walk import Walk
from app.db.models.location import Location
from app.db.models.patient import Patient
from app.db.state import walk_state_cache
from app.core.utils import format_timestamp_utc
from app.core.constants import MAX_LOCATION_HISTORY
from app.api.websocket.connection_manager import ConnectionManager


class SnapshotService:
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager

    def build_snapshot_payload(
        self,
        db: Session,
        group_id: int,
        watchers_count: int
    ) -> Dict[str, Any]:
        active_walk = db.query(Walk).filter(
            Walk.active == True,
            Walk.patient_id == db.query(Patient.id).filter(Patient.group_id == group_id).scalar_subquery()
        ).first()

        payload = {
            "type": "snapshot",
            "group_id": group_id,
            "watchers_count": watchers_count,
            "server_timestamp": format_timestamp_utc(datetime.now(timezone.utc)),
            "active_walk": None
        }

        if active_walk:
            cached = walk_state_cache.get(active_walk.id)
            payload["active_walk"] = {
                "id": active_walk.id,
                "patient_id": active_walk.patient_id,
                "start_time": format_timestamp_utc(active_walk.start_time),
                "status": "active"
            }

            if cached:
                payload["active_walk"]["latest_location"] = cached["latest"]
                payload["active_walk"]["history"] = cached["history"]
            else:
                history = db.query(Location)\
                    .filter(Location.walk_id == active_walk.id)\
                    .order_by(Location.timestamp.desc())\
                    .limit(MAX_LOCATION_HISTORY).all()
                history.reverse()
                history_dicts = [
                    {
                        "latitude": loc.latitude,
                        "longitude": loc.longitude,
                        "timestamp": format_timestamp_utc(loc.timestamp)
                    }
                    for loc in history
                ]
                payload["active_walk"]["latest_location"] = history_dicts[-1] if history_dicts else None
                payload["active_walk"]["history"] = history_dicts

        return payload

    async def send_snapshot(self, websocket, db: Session, group_id: int):
        watchers_count = self.connection_manager.get_watchers_count(group_id)
        payload = self.build_snapshot_payload(db, group_id, watchers_count)
        await websocket.send_json(payload)
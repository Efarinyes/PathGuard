import logging
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from app.db.models.group import Group
from app.db.models.walk import Walk
from app.api.websocket.event_publisher import event_publisher
from app.core.utils import format_timestamp_utc

logger = logging.getLogger(__name__)


class SOSService:

    @staticmethod
    def is_sos_enabled(db: Session, group: Group) -> bool:
        return group.sos_enabled

    @staticmethod
    def get_active_walk_id(db: Session, patient_id: int) -> int | None:
        active_walk = db.query(Walk).filter(
            Walk.active == True,
            Walk.patient_id == patient_id
        ).first()
        return active_walk.id if active_walk else None

    @staticmethod
    def increment_sos_count(db: Session, group: Group, walk_id: int | None) -> int:
        group.sos_count += 1
        group.last_sos_walk_id = walk_id
        db.commit()
        db.refresh(group)
        return group.sos_count

    @staticmethod
    async def trigger_sos_alert(
        db: Session,
        group: Group,
        patient_id: int,
        walk_id: int | None
    ) -> dict[str, Any]:
        sos_count = SOSService.increment_sos_count(db, group, walk_id)

        await event_publisher.publish("sos_alert", {
            "group_id": group.id,
            "walk_id": walk_id,
            "patient_id": patient_id,
            "sos_count": sos_count,
            "timestamp": format_timestamp_utc(datetime.now(timezone.utc))
        })

        return {
            "success": True,
            "sos_count": sos_count,
            "message": "SOS alert sent successfully"
        }


sos_service = SOSService()
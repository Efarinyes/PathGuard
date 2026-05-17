from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.db.models.walk import Walk
from app.db.models.location import Location
from app.db.models.patient import Patient
from app.db.state import walk_state_cache
from app.api.websocket.event_publisher import event_publisher
from app.core.constants import MAX_LOCATION_HISTORY
from app.core.utils import format_timestamp_utc


class WalkService:
    @staticmethod
    def start_walk(
        db: Session,
        patient: Patient,
        initiated_by_type: str,
        initiated_by_id: int
    ) -> int:
        # Check if there's already an active walk for THIS patient
        active_walk = db.query(Walk).filter(
            Walk.active == True, 
            Walk.patient_id == patient.id
        ).first()
        
        if active_walk:
            raise ValueError("Walk already active")
        
        # Create new walk
        new_walk = Walk(
            start_time=datetime.now(timezone.utc),
            active=True,
            patient_id=patient.id,
            initiated_by_type=initiated_by_type,
            initiated_by_id=initiated_by_id
        )
        db.add(new_walk)
        db.commit()
        db.refresh(new_walk)
        
        return new_walk.id

    @staticmethod
    async def start_walk_with_broadcast(
        db: Session,
        patient: Patient,
        initiated_by_type: str,
        initiated_by_id: int
    ) -> int:
        walk_id = WalkService.start_walk(db, patient, initiated_by_type, initiated_by_id)

        walk = db.query(Walk).filter(Walk.id == walk_id).first()

        await event_publisher.publish("walk_started", {
            "group_id": patient.group_id,
            "walk_id": walk.id,
            "patient_id": patient.id,
            "start_time": format_timestamp_utc(walk.start_time)
        })

        return walk_id

    @staticmethod
    def stop_walk(
        db: Session,
        patient: Patient,
        stopped_by_type: str,
        stopped_by_id: int
    ) -> dict[str, Any]:
        # Find the active walk for THIS patient ONLY
        active_walk = db.query(Walk).filter(
            Walk.active == True, 
            Walk.patient_id == patient.id
        ).first()
        
        if not active_walk:
            raise ValueError("No active walk found")
        
        # Final Trajectory Integrity Check (Order of Ingestion)
        locations = sorted(active_walk.locations, key=lambda l: l.id)
        integrity_errors = []
        if len(locations) > 1:
            for i in range(1, len(locations)):
                if locations[i].timestamp < locations[i-1].timestamp:
                    integrity_errors.append(f"Temporal regression at {locations[i].id}")
        
        # Update the walk
        active_walk.active = False
        active_walk.end_time = datetime.now(timezone.utc)
        active_walk.stopped_by_type = stopped_by_type
        active_walk.stopped_by_id = stopped_by_id
        
        # Clear the live cache
        walk_state_cache.clear(active_walk.id)
        
        db.commit()
        
        return {
            "id": active_walk.id,
            "location_count": len(locations),
            "is_valid": len(integrity_errors) == 0,
            "points_count": len(locations),
            "errors": integrity_errors if integrity_errors else None
        }

    @staticmethod
    async def stop_walk_with_broadcast(
        db: Session,
        patient: Patient,
        stopped_by_type: str,
        stopped_by_id: int
    ) -> dict[str, Any]:
        result = WalkService.stop_walk(db, patient, stopped_by_type, stopped_by_id)

        walk = db.query(Walk).filter(Walk.id == result["id"]).first()

        integrity_report = {
            "is_valid": result["is_valid"],
            "points_count": result["points_count"],
            "errors": result["errors"]
        }

        await event_publisher.publish("walk_stopped", {
            "group_id": patient.group_id,
            "walk_id": walk.id,
            "patient_id": patient.id,
            "end_time": walk.end_time.isoformat(),
            "integrity": integrity_report
        })

        return {
            "id": walk.id,
            "location_count": result["location_count"],
            "integrity": integrity_report
        }

    @staticmethod
    def get_walk_locations(
        db: Session,
        walk_id: int,
        patient: Patient
    ) -> list[dict[str, Any]]:
        # Verify the walk exists AND belongs to the authorized patient
        walk = db.query(Walk).filter(
            Walk.id == walk_id, 
            Walk.patient_id == patient.id
        ).first()
        
        if not walk:
            raise ValueError("Walk not found or access denied")
        
        # Fetch locations ordered by timestamp
        locations = db.query(Location).filter(Location.walk_id == walk_id).order_by(Location.timestamp.asc()).all()
        
        return [
            {
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "timestamp": loc.timestamp
            }
            for loc in locations
        ]

    @staticmethod
    def get_active_walk(
        db: Session,
        patient: Patient
    ) -> dict[str, Any]:
        # Find the active walk for this patient
        active_walk = db.query(Walk).filter(
            Walk.active == True, 
            Walk.patient_id == patient.id
        ).first()
        
        if not active_walk:
            return {"active_walk": None}
        
        # Try to fetch from in-memory cache first for speed
        cached_data = walk_state_cache.get(active_walk.id)
        
        if cached_data:
            return {
                "active_walk": {
                    "id": active_walk.id,
                    "patient_id": patient.id,
"start_time": format_timestamp_utc(active_walk.start_time),
                    "status": "active",
                    "latest_location": cached_data["latest"],
                    "history": cached_data["history"]
                }
            }
        
        # Fallback to DB if cache is empty
        history = db.query(Location)\
            .filter(Location.walk_id == active_walk.id)\
            .order_by(Location.timestamp.desc())\
            .limit(MAX_LOCATION_HISTORY)\
            .all()
        
        history.reverse()
        history_dicts = [
            {
                "latitude": loc.latitude, 
                "longitude": loc.longitude, 
                "timestamp": format_timestamp_utc(loc.timestamp)
            } for loc in history
        ]
        
        latest_dict = history_dicts[-1] if history_dicts else None
        
        # Optional: Seed cache if it was empty
        if latest_dict:
            walk_state_cache.update(active_walk.id, latest_dict)

        return {
            "active_walk": {
                "id": active_walk.id,
                "patient_id": patient.id,
                "start_time": format_timestamp_utc(active_walk.start_time),
                "status": "active",
                "latest_location": latest_dict,
                "history": history_dicts
            }
        }

    @staticmethod
    def read_walks(
        db: Session,
        patient: Patient
    ) -> list[dict[str, Any]]:
        # Fetch all walks belonging to the active patient, newest first
        walks = db.query(Walk).filter(
            Walk.patient_id == patient.id
        ).order_by(Walk.start_time.desc()).all()
        
        return [
            {
                "id": walk.id,
                "start_time": walk.start_time,
                "end_time": walk.end_time.isoformat() if walk.end_time else None,
                "active": walk.active,
                "duration_seconds": int((walk.end_time - walk.start_time).total_seconds()) if (walk.end_time and walk.start_time) else 0
            }
            for walk in walks
        ]


walk_service = WalkService()
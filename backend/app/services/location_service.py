from datetime import datetime
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.db.models.location import Location
from app.db.models.walk import Walk
from app.db.models.patient import Patient
from app.db.state import walk_state_cache
from app.api.websocket.event_publisher import event_publisher
from app.core.utils import format_timestamp_utc


class LocationService:

    @staticmethod
    def verify_walk(db: Session, walk_id: int, patient: Patient) -> Walk:
        walk = db.query(Walk).filter(
            Walk.id == walk_id,
            Walk.patient_id == patient.id
        ).first()
        
        if not walk or not walk.active:
            raise ValueError("Invalid or inactive walk")
        
        return walk

    @staticmethod
    def save_location(
        db: Session,
        latitude: float,
        longitude: float,
        timestamp: datetime,
        walk_id: int,
        client_id: Optional[str] = None,
        is_recovered: bool = False,
        patient: Optional[Patient] = None
    ) -> dict[str, Any]:
        # Idempotency Check
        if client_id:
            existing = db.query(Location).filter(Location.client_id == client_id).first()
            if existing:
                ts_str = format_timestamp_utc(existing.timestamp)
                return {
                    "type": "location",
                    "status": "already_synced",
                    "id": existing.id,
                    "walk_id": existing.walk_id,
                    "latitude": existing.latitude,
                    "longitude": existing.longitude,
                    "timestamp": ts_str,
                    "is_recovered": existing.is_recovered
                }

        # Verify walk exists and is active
        LocationService.verify_walk(db, walk_id, patient)

        # Create new location
        new_location = Location(
            walk_id=walk_id,
            latitude=latitude,
            longitude=longitude,
            timestamp=timestamp,
            client_id=client_id,
            is_recovered=is_recovered
        )
        
        db.add(new_location)
        db.commit()
        db.refresh(new_location)
        
        ts_str = format_timestamp_utc(new_location.timestamp)

        location_data = {
            "type": "location",
            "status": "synced",
            "id": new_location.id,
            "walk_id": new_location.walk_id,
            "latitude": new_location.latitude,
            "longitude": new_location.longitude,
            "timestamp": ts_str,
            "is_recovered": new_location.is_recovered
        }
        
        # Update cache
        walk_state_cache.update(walk_id, location_data)
        
        # Broadcast if patient available
        if patient:
            return location_data
        
        return location_data

    @staticmethod
    async def save_location_with_broadcast(
        db: Session,
        latitude: float,
        longitude: float,
        timestamp: datetime,
        walk_id: int,
        client_id: Optional[str] = None,
        is_recovered: bool = False,
        patient: Optional[Patient] = None
    ) -> dict[str, Any]:
        result = LocationService.save_location(
            db, latitude, longitude, timestamp, walk_id, client_id, is_recovered, patient
        )

        if patient:
            await event_publisher.publish("location", {
                "group_id": patient.group_id,
                **result
            })

        return result

    @staticmethod
    async def save_batch(
        db: Session,
        walk_id: int,
        batch_id: str,
        points: list[dict],
        patient: Patient
    ) -> dict[str, Any]:
        # Verify walk
        walk = LocationService.verify_walk(db, walk_id, patient)
        
        inserted_count = 0
        broadcast_events = []

        for p in points:
            client_id = p.get("client_id")
            is_recovered = p.get("is_recovered", False)
            
            # Idempotency check per point
            if client_id:
                existing = db.query(Location).filter(Location.client_id == client_id).first()
                if existing:
                    continue
            
            new_loc = Location(
                walk_id=walk_id,
                latitude=p["latitude"],
                longitude=p["longitude"],
                timestamp=p["timestamp"],
                client_id=client_id,
                is_recovered=is_recovered
            )
            db.add(new_loc)
            inserted_count += 1
            
            # Prepare for broadcast
            ts_str = format_timestamp_utc(p["timestamp"])
            
            broadcast_events.append({
                "type": "location",
                "latitude": p["latitude"],
                "longitude": p["longitude"],
                "timestamp": ts_str,
                "walk_id": walk_id,
                "is_recovered": is_recovered or False
            })

        if inserted_count > 0:
            db.commit()
            
            # Update cache with LATEST point from batch
            last_point = points[-1]
            last_ts_str = format_timestamp_utc(last_point["timestamp"])
            
            walk_state_cache.update(walk_id, {
                "latitude": last_point["latitude"],
                "longitude": last_point["longitude"],
                "timestamp": last_ts_str
            })
            
            # Broadcast individual events
            for event in broadcast_events:
                await event_publisher.publish("location", {
                    "group_id": patient.group_id,
                    **event
                })

        return {
            "status": "synced",
            "inserted": inserted_count,
            "batch_id": batch_id
        }


location_service = LocationService()
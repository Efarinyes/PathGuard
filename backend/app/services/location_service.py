from datetime import datetime
from typing import Any, Optional
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from app.db.models.location import Location
from app.db.models.walk import Walk
from app.db.models.patient import Patient
from app.db.state import walk_state_cache
from app.api.websocket.event_publisher import event_publisher
from app.api.websocket.connection_manager import connection_manager
from app.core.utils import format_timestamp_utc


def upsert_location(db: Session, values: dict) -> bool:
    """Atomic INSERT ON CONFLICT with intelligent merge for is_recovered.

    If a row with the same client_id already exists, is_recovered is
    updated to the MAX of the existing and new value (once true, stays true).
    Returns True if a new row was inserted, False if it was an update or conflict.
    """
    dialect_name = db.get_bind().dialect.name
    client_id = values.get("client_id")

    is_new = True
    if client_id:
        is_new = not db.query(
            db.query(Location).filter(Location.client_id == client_id).exists()
        ).scalar()

    if dialect_name == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        stmt = pg_insert(Location).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=['client_id'],
            set_={
                'is_recovered': func.greatest(
                    Location.__table__.c.is_recovered,
                    stmt.excluded.is_recovered
                )
            }
        )
        db.execute(stmt)
    else:
        table_name = Location.__tablename__
        stmt = text(f"""
            INSERT INTO {table_name}
            (walk_id, latitude, longitude, timestamp, client_id, is_recovered)
            VALUES (:walk_id, :latitude, :longitude, :timestamp, :client_id, :is_recovered)
            ON CONFLICT(client_id) DO UPDATE SET
                is_recovered = max(is_recovered, excluded.is_recovered)
        """)
        db.execute(stmt, values)
    return is_new


def _validate_coordinates(lat: float, lng: float) -> None:
    if not (-90 <= lat <= 90):
        raise ValueError(f"Latitude out of range: {lat}")
    if not (-180 <= lng <= 180):
        raise ValueError(f"Longitude out of range: {lng}")


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
        # Validate coordinate range
        _validate_coordinates(latitude, longitude)

        # Verify walk exists and is active
        LocationService.verify_walk(db, walk_id, patient)

        if client_id:
            values = {
                "walk_id": walk_id,
                "latitude": latitude,
                "longitude": longitude,
                "timestamp": timestamp,
                "client_id": client_id,
                "is_recovered": is_recovered or False,
            }
            inserted = upsert_location(db, values)
            if not inserted:
                existing = db.query(Location).filter(Location.client_id == client_id).first()
                ts_str = format_timestamp_utc(existing.timestamp)
                return {
                    "type": "location",
                    "status": "already_synced",
                    "id": existing.id,
                    "walk_id": existing.walk_id,
                    "latitude": existing.latitude,
                    "longitude": existing.longitude,
                    "timestamp": ts_str,
                    "is_recovered": existing.is_recovered,
                }
            db.commit()
            new_location = db.query(Location).filter(Location.client_id == client_id).first()
        else:
            new_location = Location(
                walk_id=walk_id,
                latitude=latitude,
                longitude=longitude,
                timestamp=timestamp,
                client_id=None,
                is_recovered=is_recovered,
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
            "is_recovered": new_location.is_recovered,
        }

        # Update cache
        walk_state_cache.update(walk_id, location_data)

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
            _validate_coordinates(p["latitude"], p["longitude"])

            client_id = p.get("client_id")
            is_recovered = p.get("is_recovered", False)

            if client_id:
                values = {
                    "walk_id": walk_id,
                    "latitude": p["latitude"],
                    "longitude": p["longitude"],
                    "timestamp": p["timestamp"],
                    "client_id": client_id,
                    "is_recovered": is_recovered or False,
                }
                inserted = upsert_location(db, values)
                if not inserted:
                    continue
            else:
                new_loc = Location(
                    walk_id=walk_id,
                    latitude=p["latitude"],
                    longitude=p["longitude"],
                    timestamp=p["timestamp"],
                    client_id=None,
                    is_recovered=is_recovered,
                )
                db.add(new_loc)

            inserted_count += 1

            ts_str = format_timestamp_utc(p["timestamp"])

            broadcast_events.append({
                "type": "location",
                "latitude": p["latitude"],
                "longitude": p["longitude"],
                "timestamp": ts_str,
                "walk_id": walk_id,
                "is_recovered": is_recovered or False,
            })

        if inserted_count > 0:
            db.commit()
            connection_manager.update_http_presence(patient.group_id)

            # Update cache with LATEST point from batch
            last_point = points[-1]
            last_ts_str = format_timestamp_utc(last_point["timestamp"])

            walk_state_cache.update(walk_id, {
                "latitude": last_point["latitude"],
                "longitude": last_point["longitude"],
                "timestamp": last_ts_str,
                "is_recovered": last_point.get("is_recovered", False),
            })

            # Sprint 2.5: Sort broadcast events by timestamp before publishing
            broadcast_events.sort(key=lambda e: e["timestamp"])

            # Broadcast individual events
            for event in broadcast_events:
                await event_publisher.publish("location", {
                    "group_id": patient.group_id,
                    **event,
                })

        return {
            "status": "synced",
            "inserted": inserted_count,
            "batch_id": batch_id,
        }


location_service = LocationService()
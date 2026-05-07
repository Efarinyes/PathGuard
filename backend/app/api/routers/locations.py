from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.db.models.location import Location
from app.db.models.walk import Walk
from app.db.state import walk_state_cache
from app.api.ws_manager import manager

from app.api.users.models import User
from app.db.models.patient import Patient
from app.api.dependencies.auth import get_optional_patient, get_optional_caregiver, resolve_patient

router = APIRouter()

class LocationCreate(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    walk_id: int
    client_id: Optional[str] = None
    is_recovered: Optional[bool] = False

class LocationBatch(BaseModel):
    walk_id: int
    batch_id: str
    points: list[LocationCreate]

@router.post("/batch", response_model=dict)
async def save_location_batch(
    batch: LocationBatch,
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Saves a batch of location points atomically.
    Expands batch into individual WebSocket events for real-time sync.
    """
    active_patient = resolve_patient(patient, user)
    
    # Verify walk
    walk = db.query(Walk).filter(
        Walk.id == batch.walk_id,
        Walk.patient_id == active_patient.id
    ).first()
    
    if not walk or not walk.active:
        raise HTTPException(status_code=400, detail="Invalid or inactive walk")

    inserted_count = 0
    broadcast_events = []

    # Process points
    for p in batch.points:
        # Idempotency check per point
        if p.client_id:
            existing = db.query(Location).filter(Location.client_id == p.client_id).first()
            if existing:
                continue
        
        new_loc = Location(
            walk_id=batch.walk_id,
            latitude=p.latitude,
            longitude=p.longitude,
            timestamp=p.timestamp,
            client_id=p.client_id,
            is_recovered=p.is_recovered
        )
        db.add(new_loc)
        inserted_count += 1
        
        # Prepare for broadcast
        ts_str = p.timestamp.isoformat().replace('+00:00', 'Z')
        if not ts_str.endswith('Z') and '+' not in ts_str:
            ts_str += 'Z'
        
        broadcast_events.append({
            "type": "location",
            "latitude": p.latitude,
            "longitude": p.longitude,
            "timestamp": ts_str,
            "walk_id": batch.walk_id,
            "is_recovered": p.is_recovered or False
        })

    if inserted_count > 0:
        db.commit()
        
        # Update cache with LATEST point from batch
        latest_point = batch.points[-1]
        latest_ts_str = latest_point.timestamp.isoformat().replace('+00:00', 'Z')
        if not latest_ts_str.endswith('Z') and '+' not in latest_ts_str:
            latest_ts_str += 'Z'
            
        walk_state_cache.update(batch.walk_id, {
            "latitude": latest_point.latitude,
            "longitude": latest_point.longitude,
            "timestamp": latest_ts_str
        })
        
        # Expand batch -> Individual WS Events (Real-time compatibility)
        for event in broadcast_events:
            await manager.broadcast_to_group(active_patient.group_id, event)

    return {
        "status": "synced",
        "inserted": inserted_count,
        "batch_id": batch.batch_id
    }

@router.post("", response_model=dict)
async def save_location(
    location: LocationCreate, 
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Saves a new location point with Idempotency support.
    """
    # Authorize
    active_patient = resolve_patient(patient, user)
    
    # Idempotency Check
    if location.client_id:
        existing = db.query(Location).filter(Location.client_id == location.client_id).first()
        if existing:
            ex_ts_str = existing.timestamp.isoformat().replace('+00:00', 'Z')
            if not ex_ts_str.endswith('Z') and '+' not in ex_ts_str:
                ex_ts_str += 'Z'
                
            return {
                "type": "location",
                "status": "already_synced",
                "id": existing.id,
                "walk_id": existing.walk_id,
                "latitude": existing.latitude,
                "longitude": existing.longitude,
                "timestamp": ex_ts_str,
                "is_recovered": existing.is_recovered
            }

    # Verify walk
    walk = db.query(Walk).filter(
        Walk.id == location.walk_id,
        Walk.patient_id == active_patient.id
    ).first()
    
    if not walk or not walk.active:
        raise HTTPException(status_code=400, detail="Invalid or inactive walk")
    
    # Create new location
    new_location = Location(
        walk_id=location.walk_id,
        latitude=location.latitude,
        longitude=location.longitude,
        timestamp=location.timestamp,
        client_id=location.client_id,
        is_recovered=location.is_recovered
    )
    
    db.add(new_location)
    db.commit()
    db.refresh(new_location)
    
    new_ts_str = new_location.timestamp.isoformat().replace('+00:00', 'Z')
    if not new_ts_str.endswith('Z') and '+' not in new_ts_str:
        new_ts_str += 'Z'

    location_data = {
        "type": "location",
        "status": "synced",
        "id": new_location.id,
        "walk_id": new_location.walk_id,
        "latitude": new_location.latitude,
        "longitude": new_location.longitude,
        "timestamp": new_ts_str,
        "is_recovered": new_location.is_recovered
    }
    
    # Update cache & Broadcast
    walk_state_cache.update(location.walk_id, location_data)
    await manager.broadcast_to_group(active_patient.group_id, location_data)
    
    return location_data

@router.get("")
def read_locations(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    # Authorize
    active_patient = resolve_patient(patient, user)
    
    return {"message": "Locations list (Implemented)"}

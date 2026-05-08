from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import database as db_session

from app.api.users.models import User
from app.db.models.patient import Patient
from app.db.models.location import Location
from app.api.dependencies.auth import get_optional_patient, get_optional_caregiver, resolve_patient
from app.services.location_service import location_service

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
    
    points_data = [
        {
            "latitude": p.latitude,
            "longitude": p.longitude,
            "timestamp": p.timestamp,
            "client_id": p.client_id,
            "is_recovered": p.is_recovered
        }
        for p in batch.points
    ]
    
    try:
        return await location_service.save_batch(
            db=db,
            walk_id=batch.walk_id,
            batch_id=batch.batch_id,
            points=points_data,
            patient=active_patient
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    active_patient = resolve_patient(patient, user)
    
    try:
        return await location_service.save_location_with_broadcast(
            db=db,
            latitude=location.latitude,
            longitude=location.longitude,
            timestamp=location.timestamp,
            walk_id=location.walk_id,
            client_id=location.client_id,
            is_recovered=location.is_recovered,
            patient=active_patient
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
def read_locations(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    # Authorize
    active_patient = resolve_patient(patient, user)
    
    return {"message": "Locations list (Implemented)"}

@router.get("/sync/status")
def get_sync_status(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns sync status for the authenticated patient.
    Used by client to show sync progress indicator.
    """
    active_patient = resolve_patient(patient, user)
    
    if active_patient is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = db.query(
        func.max(Location.timestamp).label("last_sync")
    ).filter(
        Location.walk_id.in_(
            db.query(Location.walk_id).join(Patient).filter(Patient.id == active_patient.id)
        )
    ).scalar()
    
    return {
        "last_sync": result.isoformat() if result else None
    }
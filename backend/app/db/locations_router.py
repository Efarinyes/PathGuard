from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.api.models.location import Location
from app.api.models.walk import Walk
from app.db.state import walk_state_cache
from app.db.websockets_router import manager

from app.api.users.models import User
from app.api.models.patient import Patient
from app.db.auth_deps import get_optional_patient, get_optional_caregiver, resolve_patient

router = APIRouter()

class LocationCreate(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    walk_id: int
@router.post("", response_model=dict)
async def save_location(
    location: LocationCreate, 
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Saves a new location point and broadcasts it to all connected caregivers.
    Also updates the in-memory state cache for fast recovery.
    """
    # Authorize
    active_patient = resolve_patient(patient, user)
    
    # Verify the walk exists and is active
    walk = db.query(Walk).filter(Walk.id == location.walk_id).first()
    
    if not walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Walk not found"
        )
    
    if not walk.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add location to an inactive walk"
        )
    
    # Create new location
    new_location = Location(
        walk_id=location.walk_id,
        latitude=location.latitude,
        longitude=location.longitude,
        timestamp=location.timestamp
    )
    
    db.add(new_location)
    db.commit()
    db.refresh(new_location)
    
    location_data = {
        "type": "location",
        "id": new_location.id,
        "walk_id": new_location.walk_id,
        "latitude": new_location.latitude,
        "longitude": new_location.longitude,
        "timestamp": new_location.timestamp.isoformat() if new_location.timestamp else None
    }
    
    # ⚡ Update the live cache for /walks/active recovery
    walk_state_cache.update(location.walk_id, location_data)
    
    # Broadcast to all connected caregivers
    await manager.broadcast(location_data)
    
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

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.api.models.walk import Walk
from app.api.models.location import Location

from app.api.users.models import User
from app.api.models.patient import Patient
from app.db.auth_deps import get_optional_patient, get_optional_caregiver, resolve_patient

router = APIRouter()

@router.post("/start", response_model=int)
def start_walk(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Starts a new walk session. Only one active walk is allowed at a time.
    """
    # Authorize
    active_patient = resolve_patient(patient, user)
    initiated_by_type = "patient" if patient else "caregiver"
    
    # Check if there's already an active walk
    active_walk = db.query(Walk).filter(Walk.active == True).first()
    if active_walk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Walk already active"
        )
    
    # Create new walk
    new_walk = Walk(
        start_time=datetime.utcnow(),
        active=True,
        initiated_by_type=initiated_by_type
    )
    db.add(new_walk)
    db.commit()
    db.refresh(new_walk)
    
    return new_walk.id

@router.post("/stop")
def stop_walk(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Stops the currently active walk session.
    """
    # Authorize
    active_patient = resolve_patient(patient, user)
    
    # Find the active walk
    active_walk = db.query(Walk).filter(Walk.active == True).first()
    if not active_walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active walk found"
        )
    
    # Update the walk
    active_walk.active = False
    active_walk.end_time = datetime.utcnow()
    
    # Get location count for summary
    location_count = len(active_walk.locations)
    
    db.commit()
    db.refresh(active_walk)
    
    # Calculate duration
    duration = active_walk.end_time - active_walk.start_time
    
    return {
        "id": active_walk.id,
        "start_time": active_walk.start_time,
        "end_time": active_walk.end_time,
        "duration_seconds": int(duration.total_seconds()),
        "location_count": location_count
    }

@router.get("/{id}/locations", response_model=list)
def get_walk_locations(
    id: int, 
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns an ordered list of coordinates for a specific walk.
    """
    # Authorize
    active_patient = resolve_patient(patient, user)
    
    # Verify the walk exists
    walk = db.query(Walk).filter(Walk.id == id).first()
    if not walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Walk not found"
        )
    
    # Fetch locations ordered by timestamp
    locations = db.query(Location).filter(Location.walk_id == id).order_by(Location.timestamp.asc()).all()
    
    return [
        {
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "timestamp": loc.timestamp
        }
        for loc in locations
    ]

@router.get("/", response_model=list)
def read_walks(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns a list of past walk sessions.
    """
    # Authorize
    active_patient = resolve_patient(patient, user)
    
    # Fetch all finished walks, ordered by start time (newest first)
    past_walks = db.query(Walk).filter(Walk.active == False).order_by(Walk.start_time.desc()).all()
    
    result = []
    for walk in past_walks:
        duration_seconds = 0
        if walk.end_time and walk.start_time:
            duration_seconds = int((walk.end_time - walk.start_time).total_seconds())
            
        result.append({
            "id": walk.id,
            "start_time": walk.start_time,
            "end_time": walk.end_time,
            "duration_seconds": duration_seconds
        })
        
    return result

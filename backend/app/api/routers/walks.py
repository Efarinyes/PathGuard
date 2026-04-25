from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.db.models.walk import Walk
from app.db.models.location import Location

from app.api.users.models import User
from app.db.models.patient import Patient
from app.api.dependencies.auth import get_optional_patient, get_optional_caregiver, resolve_patient
from app.db.state import walk_state_cache
from app.api.ws_manager import manager

router = APIRouter()

@router.post("/start", response_model=int)
async def start_walk(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Starts a new walk session. Scoped to the caller's family group.
    """
    # Authorize: resolve_patient ensures the caregiver only sees their group's patient
    active_patient = resolve_patient(patient, user)
    initiated_by_type = "patient" if patient else "caregiver"
    initiated_by_id = patient.id if patient else user.id
    
    # Check if there's already an active walk for THIS patient
    active_walk = db.query(Walk).filter(
        Walk.active == True, 
        Walk.patient_id == active_patient.id
    ).first()
    
    if active_walk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Walk already active"
        )
    
    # Create new walk
    new_walk = Walk(
        start_time=datetime.utcnow(),
        active=True,
        patient_id=active_patient.id,
        initiated_by_type=initiated_by_type,
        initiated_by_id=initiated_by_id
    )
    db.add(new_walk)
    db.commit()
    db.refresh(new_walk)
    
    # Broadcast to caregivers in the environment
    await manager.broadcast_to_group(active_patient.group_id, {
        "type": "walk_started",
        "walk_id": new_walk.id,
        "patient_id": active_patient.id,
        "start_time": f"{new_walk.start_time.isoformat()}Z"
    })
    
    return new_walk.id

@router.post("/stop")
async def stop_walk(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Stops the currently active walk session for the resolved patient.
    """
    active_patient = resolve_patient(patient, user)
    stopped_by_type = "patient" if patient else "caregiver"
    stopped_by_id = patient.id if patient else user.id
    
    # Find the active walk for THIS patient ONLY
    active_walk = db.query(Walk).filter(
        Walk.active == True, 
        Walk.patient_id == active_patient.id
    ).first()
    
    if not active_walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active walk found"
        )
    
    # Update the walk
    active_walk.active = False
    active_walk.end_time = datetime.utcnow()
    active_walk.stopped_by_type = stopped_by_type
    active_walk.stopped_by_id = stopped_by_id
    
    # ⚡ Clear the live cache
    walk_state_cache.clear(active_walk.id)
    
    location_count = len(active_walk.locations)
    db.commit()
    
    # Broadcast to caregivers
    await manager.broadcast_to_group(active_patient.group_id, {
        "type": "walk_stopped",
        "walk_id": active_walk.id,
        "patient_id": active_patient.id,
        "end_time": active_walk.end_time.isoformat()
    })

    return {
        "id": active_walk.id,
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
    Returns locations for a specific walk, strictly enforced by patient ownership.
    """
    active_patient = resolve_patient(patient, user)
    
    # Verify the walk exists AND belongs to the authorized patient
    walk = db.query(Walk).filter(
        Walk.id == id, 
        Walk.patient_id == active_patient.id
    ).first()
    
    if not walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Walk not found or access denied"
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

@router.get("/active")
def get_active_walk(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns the currently active walk state for recovery, scoped to the family group.
    """
    active_patient = resolve_patient(patient, user)
    
    # Find the active walk for this patient
    active_walk = db.query(Walk).filter(
        Walk.active == True, 
        Walk.patient_id == active_patient.id
    ).first()
    
    if not active_walk:
        return {"active_walk": None}
    
    # Cache and recovery logic remains the same but is now implicitly safe
    cached_data = walk_state_cache.get(active_walk.id)
    if cached_data:
        return {
            "active_walk_id": active_walk.id,
            "patient_id": active_patient.id,
            "latest_location": cached_data["latest"],
            "history": cached_data["history"]
        }
    
    # Fallback to DB
    history = db.query(Location)\
        .filter(Location.walk_id == active_walk.id)\
        .order_by(Location.timestamp.desc())\
        .limit(50)\
        .all()
    
    history.reverse()
    history_dicts = [{"latitude": loc.latitude, "longitude": loc.longitude, "timestamp": loc.timestamp.isoformat()} for loc in history]
    
    return {
        "active_walk_id": active_walk.id,
        "patient_id": active_patient.id,
        "latest_location": history_dicts[-1] if history_dicts else None,
        "history": history_dicts
    }

@router.get("/", response_model=list)
def read_walks(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns a list of past walk sessions for the family group.
    """
    active_patient = resolve_patient(patient, user)
    
    # Fetch only walks belonging to the active patient
    past_walks = db.query(Walk).filter(
        Walk.active == False,
        Walk.patient_id == active_patient.id
    ).order_by(Walk.start_time.desc()).all()
    
    return [
        {
            "id": walk.id,
            "start_time": walk.start_time,
            "end_time": walk.end_time,
            "duration_seconds": int((walk.end_time - walk.start_time).total_seconds()) if walk.end_time else 0
        }
        for walk in past_walks
    ]

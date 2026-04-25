from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.api.models.walk import Walk
from app.api.models.location import Location

from app.api.users.models import User
from app.api.models.patient import Patient
from app.db.auth_deps import get_optional_patient, get_optional_caregiver, resolve_patient
from app.db.state import walk_state_cache
from app.db.websockets_router import manager

router = APIRouter()

@router.post("/start", response_model=int)
async def start_walk(
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
    initiated_by_id = patient.id if patient else user.id
    
    # Check if there's already an active walk
    #active_walk = db.query(Walk).filter(Walk.active == True, Walk.patient_id == active_patient.id).first()
    active_walk = db.query(Walk).filter(Walk.active==True, Walk.patient_id == active_patient.id).first()
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
    
    # Broadcast to caregivers
    await manager.broadcast({
        "type": "walk_started",
        "walk_id": new_walk.id,
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
    Stops the currently active walk session.
    """
    # Authorize
    active_patient = resolve_patient(patient, user)
    stopped_by_type = "patient" if patient else "caregiver"
    stopped_by_id = patient.id if patient else user.id
    
    # Find the active walk
    active_walk = db.query(Walk).filter(Walk.active == True, Walk.patient_id == active_patient.id).first()
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
    
    # ⚡ Clear the live cache as the walk is no longer active
    walk_state_cache.clear(active_walk.id)
    
    # Get location count for summary
    location_count = len(active_walk.locations)
    
    db.commit()
    db.refresh(active_walk)
    
    # Calculate duration
    duration = active_walk.end_time - active_walk.start_time
    
    # Broadcast to caregivers
    await manager.broadcast({
        "type": "walk_stopped",
        "walk_id": active_walk.id,
        "end_time": active_walk.end_time.isoformat()
    })

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

@router.get("/active")
def get_active_walk(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns the currently active walk state for recovery.
    Used by caregivers when refreshing the dashboard.
    """
    # Authorize
    active_patient = resolve_patient(patient, user)
    
    # Find the active walk
    active_walk = db.query(Walk).filter(Walk.active == True, Walk.patient_id == active_patient.id).first()
    
    if not active_walk:
        return {"active_walk": None}
    
    # ⚡ Try to fetch from in-memory cache first for speed
    cached_data = walk_state_cache.get(active_walk.id)
    if cached_data:
        return {
            "active_walk_id": active_walk.id,
            "patient_id": active_patient.id,
            "latest_location": {
                **cached_data["latest"],
                "timestamp": f'{cached_data["latest"]["timestamp"]}Z' if not cached_data["latest"]["timestamp"].endswith('Z') else cached_data["latest"]["timestamp"]
            },
            "history": [
                {**p, "timestamp": f'{p["timestamp"]}Z' if not p["timestamp"].endswith("Z") else p["timestamp"]}
                for p in cached_data["history"]
            ]
        }
    
    # Fallback to DB if cache is empty (e.g. after server restart)
    history = db.query(Location)\
        .filter(Location.walk_id == active_walk.id)\
        .order_by(Location.timestamp.desc())\
        .limit(50)\
        .all()
    
    history.reverse()
    latest_location = history[-1] if history else None
    
    # Re-populate cache for next time
    history_dicts = [
        {
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "timestamp": loc.timestamp.isoformat() if loc.timestamp else None
        } for loc in history
    ]
    
    if latest_location:
        latest_dict = {
            "latitude": latest_location.latitude,
            "longitude": latest_location.longitude,
            "timestamp": latest_location.timestamp.isoformat() if latest_location.timestamp else None
        }
        walk_state_cache.update(active_walk.id, latest_dict) # This will also populate history

    return {
        "active_walk_id": active_walk.id,
        "patient_id": active_patient.id,
        "latest_location": latest_dict if latest_location else None,
        "history": history_dicts
    }

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

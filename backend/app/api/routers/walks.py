from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import database as db_session

from app.api.users.models import User
from app.db.models.patient import Patient
from app.api.dependencies.auth import get_optional_patient, get_optional_caregiver, get_current_caregiver, resolve_patient
from app.services.walk_service import walk_service

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
    active_patient = resolve_patient(patient, user)
    initiated_by_type = "patient" if patient else "caregiver"
    initiated_by_id = patient.id if patient else user.id
    
    try:
        return await walk_service.start_walk_with_broadcast(
            db=db,
            patient=active_patient,
            initiated_by_type=initiated_by_type,
            initiated_by_id=initiated_by_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

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
    
    try:
        return await walk_service.stop_walk_with_broadcast(
            db=db,
            patient=active_patient,
            stopped_by_type=stopped_by_type,
            stopped_by_id=stopped_by_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/{id}/locations", response_model=list)
def get_walk_locations(
    id: int, 
    db: Session = Depends(db_session.get_db),
    user: User = Depends(get_current_caregiver)
):
    """
    Returns locations for a specific walk.
    Only the group owner can access walk detail locations.
    """
    if not user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can view walk details"
        )
    
    active_patient = user.group.patient if user.group else None
    if not active_patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient found in this group"
        )
    
    try:
        return walk_service.get_walk_locations(db=db, walk_id=id, patient=active_patient)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/active")
def get_active_walk(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns the currently active walk state for recovery.
    Optimized for fast UI rehydration on page refresh.
    """
    active_patient = resolve_patient(patient, user)
    return walk_service.get_active_walk(db=db, patient=active_patient)

@router.get("/", response_model=list)
def read_walks(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns a list of walk sessions for the family group, including active one.
    """
    active_patient = resolve_patient(patient, user)
    return walk_service.read_walks(db=db, patient=active_patient)
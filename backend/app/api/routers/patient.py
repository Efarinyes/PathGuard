from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.api.users.models import User
from app.db.models.patient import Patient
from app.db.models.group import Group
from app.api.dependencies.auth import get_optional_patient, get_optional_caregiver, resolve_patient

router = APIRouter()


@router.get("/status")
def get_patient_status(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns patient configuration and status for the app boot sequence.
    Includes sos_enabled flag and basic patient info.
    """
    active_patient = resolve_patient(patient, user)
    group = active_patient.group

    return {
        "sos_enabled": group.sos_enabled,
        "patient_name": active_patient.name,
        "group_id": group.id
    }
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.api.users.models import User
from app.db.models.patient import Patient
from app.db.models.group import Group
from app.api.dependencies.auth import get_optional_patient, get_optional_caregiver, resolve_patient
from app.services.sos_service import sos_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/trigger")
async def trigger_sos(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Triggers an SOS alert for the patient's group.
    SOS must be enabled for the group (set during initial group registration).
    The alert is broadcast to all caregivers in the group via WebSocket.
    """
    active_patient = resolve_patient(patient, user)
    group = active_patient.group

    if not sos_service.is_sos_enabled(db, group):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SOS is not enabled for this group"
        )

    walk_id = sos_service.get_active_walk_id(db, active_patient.id)

    return await sos_service.trigger_sos_alert(
        db=db,
        group=group,
        patient_id=active_patient.id,
        walk_id=walk_id
    )
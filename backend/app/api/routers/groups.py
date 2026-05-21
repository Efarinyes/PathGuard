from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.api.dependencies.auth import get_current_caregiver
from app.api.users.models import User

router = APIRouter()

@router.patch("/sos-toggle")
def toggle_sos(
    current_user: User = Depends(get_current_caregiver),
    db: Session = Depends(db_session.get_db)
):
    """
    Toggle the SOS enabled state for the current user's group.
    Only the group owner can modify this setting.
    Returns the new sos_enabled state.
    """
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can toggle SOS"
        )

    group = current_user.group
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    group.sos_enabled = not group.sos_enabled
    db.commit()
    db.refresh(group)

    return {"sos_enabled": group.sos_enabled}

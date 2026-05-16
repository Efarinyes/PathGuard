import uuid
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.core.security.jwt import verify_token
from app.core.constants import WS_CLOSE_CODE_UNAUTHORIZED
from app.api.users.models import User
from app.db.models.patient import Patient


class WSAuth:
    @staticmethod
    def authenticate(
        db: Session,
        token: Optional[str],
        patient_token: Optional[str]
    ) -> Tuple[Optional[int], Optional[str], Optional[int]]:
        if token:
            user_id_raw = verify_token(token)
            if user_id_raw:
                try:
                    user_id = int(user_id_raw)
                    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
                    if user:
                        return user.group_id, "caregiver", user_id
                except (ValueError, TypeError):
                    pass

        if patient_token:
            try:
                token_uuid = uuid.UUID(patient_token)
                patient = db.query(Patient).filter(Patient.device_token == token_uuid).first()
                if patient:
                    return patient.group_id, "patient", None
            except ValueError:
                pass

        return None, None, None
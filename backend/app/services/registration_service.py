import logging
import uuid
from datetime import timedelta
from typing import Any
from sqlalchemy.orm import Session
from app.core.config.settings import settings
from app.core.security.auth import create_access_token
from app.core.security.password import hash_password
from app.db.models.patient import Patient
from app.api.users.models import User
from app.db.models.group import Group

logger = logging.getLogger(__name__)


class RegistrationService:
    @staticmethod
    def register_family(
        db: Session,
        email: str,
        password: str,
        patient_name: str,
        group_name: str | None = None,
        sos_enabled: bool = False
    ) -> dict[str, Any]:
        # 1. Security Check: Validate email uniqueness
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise ValueError("User with this email already exists")

        # 2. Create Group (Environment)
        # Fallback to "[Patient Name]'s Family" if group_name is not provided
        group_name = group_name or f"Família {patient_name}"
        new_group = Group(
            name=group_name,
            sos_enabled=sos_enabled
        )
        db.add(new_group)
        db.commit()
        db.refresh(new_group)
        
        # 3. Create Patient
        new_patient = Patient(
            name=patient_name,
            device_token=str(uuid.uuid4()),
            group_id=new_group.id
        )
        db.add(new_patient)
        
        # 4. Create Caregiver User
        new_user = User(
            email=email,
            hashed_password=hash_password(password),
            is_caregiver=True,
            is_active=True,
            is_owner=True,
            group_id=new_group.id
        )
        db.add(new_user)
        db.flush()
        
        # 5. Set Group Owner
        new_group.owner_id = new_user.id
        
        # 6. Commit All
        db.commit()
        
        # 6. Generate Caregiver JWT for immediate session bootstrapping
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        caregiver_jwt = create_access_token(
            new_user.id, expires_delta=access_token_expires
        )
        
        return {
            "device_token": str(new_patient.device_token),
            "patient_id": new_patient.id,
            "caregiver_jwt": caregiver_jwt,
            "is_owner": True
        }


registration_service = RegistrationService()
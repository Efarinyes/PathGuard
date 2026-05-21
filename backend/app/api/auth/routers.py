import logging
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api import deps
from app.api.auth import services as auth_services
from app.api.auth import schemas as auth_schemas
from app.api.users.models import User
from app.db.models.patient import Patient
from app.core.config.settings import settings
from app.core.security.auth import create_access_token
from app.services.registration_service import registration_service
from app.services.invitation_service import invitation_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/register", response_model=auth_schemas.RegisterResponse)
def register(
    data: auth_schemas.RegisterRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Register a Family Group, a Patient and a Caregiver atomically.
    This is the bootstrap entry point for new environments.
    """
    try:
        return registration_service.register_family(
            db=db,
            email=data.email,
            password=data.password,
            patient_name=data.patient_name,
            group_name=data.group_name,
            sos_enabled=data.sos_enabled
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=auth_schemas.Token)
def login_access_token(
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, restricted to caregivers.
    """
    user = auth_services.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect email or password"
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.get("/me", response_model=auth_schemas.UserGroupInfo)
def get_current_user_info(
    current_user: User = Depends(deps.get_current_caregiver),
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Returns the current user's group information including patient name.
    Used by Caregiver Dashboard to display patient name and ownership status.
    """
    patient = db.query(Patient).filter(Patient.group_id == current_user.group_id).first()
    
    return {
        "patient_name": patient.name if patient else "Pacient",
        "group_name": current_user.group.name if current_user.group else "Grup",
        "is_owner": current_user.is_owner,
        "sos_enabled": current_user.group.sos_enabled if current_user.group else False
    }

@router.post("/generate-invitation", response_model=auth_schemas.GenerateInvitationResponse)
def generate_invitation(
    data: auth_schemas.GenerateInvitationRequest,
    current_user: User = Depends(deps.get_current_caregiver),
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Generate an invitation code for a new caregiver.
    Only the group owner can generate invitations.
    """
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can generate invitations"
        )

    try:
        return invitation_service.generate_invitation(
            db=db,
            email=data.email,
            created_by_user_id=current_user.id,
            group_id=current_user.group_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Invitation generation failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate invitation"
        )

@router.post("/accept-invitation", response_model=auth_schemas.AcceptInvitationResponse)
def accept_invitation(
    data: auth_schemas.AcceptInvitationRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Accept an invitation code and create a new caregiver account.
    No authentication required - uses the invitation code.
    """
    try:
        return invitation_service.accept_invitation(
            db=db,
            code=data.code,
            password=data.password
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Invitation acceptance failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to accept invitation"
        )

@router.get("/check-invitation/{code}", response_model=auth_schemas.CheckInvitationResponse)
def check_invitation(
    code: str,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Check if an invitation code is valid.
    Returns: { valid: bool, email: str | None, group_name: str | None }
    """
    return invitation_service.check_invitation(db=db, code=code)

@router.post("/activate-device", response_model=auth_schemas.ActivateDeviceResponse)
def activate_device(
    data: auth_schemas.ActivateDeviceRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Activate a patient device using an activation code.
    No authentication required — the code itself is the credential.
    Returns the device_token and patient_id for the patient's device to store.
    """
    code = data.code.strip().upper()
    patient = db.query(Patient).filter(Patient.activation_code == code).first()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid activation code"
        )

    if patient.activation_code_used:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Activation code already used"
        )

    patient.activation_code_used = True
    db.commit()
    db.refresh(patient)

    logger.info(f"Device activated for patient {patient.id} (group {patient.group_id})")

    return {
        "device_token": patient.device_token,
        "patient_id": patient.id
    }

@router.get("/patient/activation-code", response_model=auth_schemas.ActivationCodeResponse)
def get_activation_code(
    current_user: User = Depends(deps.get_current_caregiver),
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Get or regenerate the activation code for the patient in the current user's group.
    Only the group owner can access this endpoint.
    """
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can view the activation code"
        )

    patient = db.query(Patient).filter(Patient.group_id == current_user.group_id).first()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient found in this group"
        )

    if patient.activation_code_used:
        from app.db.models.patient import _generate_activation_code
        patient.activation_code = _generate_activation_code()
        patient.activation_code_used = False
        db.commit()
        db.refresh(patient)

    return {
        "activation_code": patient.activation_code,
        "is_used": patient.activation_code_used
    }
import uuid
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api import deps
from app.api.auth import services as auth_services
from app.api.auth import schemas as auth_schemas
from app.core.config.settings import settings
from app.core.security.auth import create_access_token
from app.core.security.password import hash_password
from app.db.models.patient import Patient
from app.api.users.models import User

router = APIRouter()

@router.post("/register", response_model=auth_schemas.RegisterResponse)
def register(
    data: auth_schemas.RegisterRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Register a patient and one or more caregivers atomically.
    """
    try:
        # Create patient
        patient = Patient(name=data.patient_name, device_token=uuid.uuid4())
        db.add(patient)
        
        # Create caregivers
        for cg_data in data.caregivers:
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == cg_data.email).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with email {cg_data.email} already exists"
                )
            user = User(
                email=cg_data.email,
                hashed_password=hash_password(cg_data.password),
                is_caregiver=True,
                is_active=True
            )
            # Link caregiver to patient
            user.patients.append(patient)
            db.add(user)
        
        # Commit transaction atomically
        db.commit()
        db.refresh(patient)
        
        return {
            "patient_id": patient.id,
            "device_token": patient.device_token
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
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
    OAuth2 compatible token login, get an access token for future requests
    """
    user = auth_services.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

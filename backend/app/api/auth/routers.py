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
from app.db.models.group import Group

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
    # 1. Security Check: Validate email uniqueness
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    try:
        # 2. Create Group (Environment)
        # Using a derived name: "[Patient Name]'s Family"
        new_group = Group(name=f"Família {data.patient_name}")
        db.add(new_group)
        db.flush() # Flush to generate new_group.id for FKs
        
        # 3. Create Patient
        new_patient = Patient(
            name=data.patient_name,
            device_token=uuid.uuid4(),
            group_id=new_group.id
        )
        db.add(new_patient)
        
        # 4. Create Caregiver User
        new_user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            is_caregiver=True,
            is_active=True,
            group_id=new_group.id
        )
        db.add(new_user)
        
        # 5. Atomic Commit
        db.commit()
        
        # Refresh to ensure we return persisted state
        db.refresh(new_patient)
        db.refresh(new_user)
        db.refresh(new_group)
        
        return {
            "device_token": new_patient.device_token,
            "patient_id": new_patient.id,
            "caregiver_id": new_user.id,
            "group_id": new_group.id
        }

    except Exception as e:
        db.rollback()
        # In production, we would log the full exception 'e' here
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

import uuid
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config.settings import settings
from app.db.session import database as db_session
from app.api.users.models import User
from app.db.models.patient import Patient
from app.core.security.jwt import verify_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_current_caregiver(
    db: Session = Depends(db_session.get_db), 
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Dependency to validate the JWT and ensure the user is a caregiver.
    """
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
        
    if not user.is_caregiver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
        
    return user

def get_patient_from_device_token(
    x_patient_token: str = Header(..., alias="X-Patient-Token"),
    db: Session = Depends(db_session.get_db)
) -> Patient:
    """
    Dependency to validate X-Patient-Token header and return the Patient.
    """
    try:
        token_uuid = uuid.UUID(x_patient_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device token format"
        )
        
    patient = db.query(Patient).filter(Patient.device_token == token_uuid).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device token"
        )
        
    return patient

oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", 
    auto_error=False
)

def get_optional_caregiver(
    db: Session = Depends(db_session.get_db),
    token: str | None = Depends(oauth2_scheme_optional)
) -> User | None:
    if not token:
        return None
    user_id = verify_token(token)
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.is_caregiver:
        return user
    return None

def get_optional_patient(
    x_patient_token: str | None = Header(None, alias="X-Patient-Token"),
    db: Session = Depends(db_session.get_db)
) -> Patient | None:
    if not x_patient_token:
        return None
    try:
        from uuid import UUID
        token_uuid = UUID(x_patient_token)
        return db.query(Patient).filter(Patient.device_token == token_uuid).first()
    except ValueError:
        return None

def resolve_patient(patient: Patient | None, user: User | None) -> Patient:
    if patient:
        return patient
    if user and user.patients:
        return user.patients[0]
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authorized")

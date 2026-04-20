from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api import deps
from app.api.models.user import User
from app.api.auth import schemas as auth_schemas
from app.core.security.password import verify_password
from app.core.security.jwt import create_access_token

router = APIRouter()

@router.post("/login", response_model=auth_schemas.Token)
def login(
    db: Session = Depends(deps.get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, restricted to caregivers only.
    """
    # Find user by email
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not user.is_caregiver:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )
    
    # Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )
    
    # Create access token
    access_token = create_access_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }

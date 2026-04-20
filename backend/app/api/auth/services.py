from typing import Optional
from sqlalchemy.orm import Session
from app.api.users.models import User
from app.api.users.services import get_user_by_email
from app.core.security.auth import verify_password

def authenticate(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email=email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

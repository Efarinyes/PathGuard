from typing import Optional
from sqlalchemy.orm import Session
from app.api.users.models import User
from app.api.users.schemas import UserCreate, UserUpdate
from app.core.security.password import hash_password

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user_in: UserCreate) -> User:
    db_obj = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        is_caregiver=user_in.is_caregiver,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update_user(db: Session, db_obj: User, user_in: UserUpdate) -> User:
    if user_in.password:
        db_obj.hashed_password = hash_password(user_in.password)
    
    if user_in.full_name is not None:
        db_obj.full_name = user_in.full_name
    
    if user_in.is_caregiver is not None:
        db_obj.is_caregiver = user_in.is_caregiver
        
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

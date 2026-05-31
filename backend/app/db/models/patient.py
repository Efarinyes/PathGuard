import uuid
import string
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.db.base.base_class import Base

ACTIVATION_CODE_EXPIRY_HOURS = 2

def _generate_uuid_str():
    return str(uuid.uuid4())

def _generate_activation_code():
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(6))

def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()

def _new_activation_code() -> tuple[str, str, datetime]:
    plain = _generate_activation_code()
    hashed = _hash_code(plain)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ACTIVATION_CODE_EXPIRY_HOURS)
    return plain, hashed, expires_at

class Patient(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    device_token = Column(String(36), unique=True, index=True, default=_generate_uuid_str)
    activation_code = Column(String(6), unique=True, index=True, default=_generate_activation_code)
    activation_code_hash = Column(String(64), unique=True, index=True, nullable=True)
    activation_code_used = Column(Boolean, default=False, nullable=False)
    activation_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    walks = relationship("Walk", back_populates="patient")
    group_id = Column(Integer, ForeignKey("family_group.id"), nullable=False, unique=True, index=True)
    group = relationship("Group", back_populates="patient")

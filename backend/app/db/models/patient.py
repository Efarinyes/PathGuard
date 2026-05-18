import uuid
import string
import secrets
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.db.base.base_class import Base

def _generate_uuid_str():
    return str(uuid.uuid4())

def _generate_activation_code():
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(6))

class Patient(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    device_token = Column(String(36), unique=True, index=True, default=_generate_uuid_str)
    activation_code = Column(String(6), unique=True, index=True, default=_generate_activation_code)
    activation_code_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    walks = relationship("Walk", back_populates="patient")
    group_id = Column(Integer, ForeignKey("family_group.id"), nullable=False, unique=True, index=True)
    group = relationship("Group", back_populates="patient")

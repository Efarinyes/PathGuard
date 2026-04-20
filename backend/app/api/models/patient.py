import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base.base_class import Base

patient_caregiver = Table(
    "patient_caregiver",
    Base.metadata,
    Column("patient_id", Integer, ForeignKey("patient.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("user.id"), primary_key=True)
)

class Patient(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    device_token = Column(UUID(as_uuid=True), unique=True, index=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)

    caregivers = relationship("User", secondary="patient_caregiver", back_populates="patients")

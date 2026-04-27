import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base.base_class import Base

class Patient(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    device_token = Column(UUID(as_uuid=True), unique=True, index=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)

    walks = relationship("Walk", back_populates="patient")
    group_id = Column(Integer, ForeignKey("family_group.id"), nullable=False)
    group = relationship("Group", back_populates="patient")

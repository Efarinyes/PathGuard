from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base.base_class import Base


class Group(Base):
    __tablename__ = "family_group"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    
    owner_id = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    # owner = relationship("User", foreign_keys=[owner_id])  # Removed - no FK due to SQLite circular dep
    patient = relationship("Patient", back_populates="group", uselist=False)
    caregivers = relationship("User", back_populates="group", foreign_keys="User.group_id")
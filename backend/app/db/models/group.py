from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.db.base.base_class import Base


class Group(Base):
    __tablename__ = "family_group"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    owner_id = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    sos_enabled = Column(Boolean, default=False, nullable=False)
    sos_count = Column(Integer, default=0, nullable=False)
    last_sos_walk_id = Column(Integer, ForeignKey("walk.id"), nullable=True)

    patient = relationship("Patient", back_populates="group", uselist=False)
    caregivers = relationship("User", back_populates="group", foreign_keys="User.group_id")
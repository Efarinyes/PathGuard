from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base.base_class import Base

class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, index=True)

    is_caregiver = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)

    group_id = Column(Integer, ForeignKey("family_group.id"), nullable=False, index=True)
    group = relationship("Group", back_populates="caregivers", foreign_keys=[group_id])
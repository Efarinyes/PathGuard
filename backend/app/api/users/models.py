from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.db.base.base_class import Base

class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, index=True)
    is_caregiver = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    patients = relationship("Patient", secondary="patient_caregiver", back_populates="caregivers")

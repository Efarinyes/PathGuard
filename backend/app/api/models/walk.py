from sqlalchemy import Column, Integer, DateTime, Boolean, String
from sqlalchemy.orm import relationship
from app.db.base.base_class import Base

class Walk(Base):
    """
    Walk model to track patient sessions.
    """
    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)
    initiated_by_type = Column(String(50), nullable=False)
    initiated_by_id = Column(Integer, nullable=True)
    stopped_by_type = Column(String(50), nullable=True)
    stopped_by_id = Column(Integer, nullable=True)
    
    # Relationships
    locations = relationship("Location", back_populates="walk", cascade="all, delete-orphan")

from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String, Boolean
from sqlalchemy.orm import relationship
from app.db.base.base_class import Base

class Location(Base):
    """
    Location model to store GPS coordinates for a specific walk.
    """
    id = Column(Integer, primary_key=True, index=True)
    walk_id = Column(Integer, ForeignKey("walk.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    client_id = Column(String(50), unique=True, index=True, nullable=True) # UUID for deduplication
    is_recovered = Column(Boolean, default=False)  # True if synced offline during recovery
    
    # Relationships
    walk = relationship("Walk", back_populates="locations")

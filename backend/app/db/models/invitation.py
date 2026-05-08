import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base.base_class import Base


class InvitationCode(Base):
    __tablename__ = "invitation_code"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(6), unique=True, index=True, nullable=False)
    email = Column(String, nullable=False)
    group_id = Column(Integer, ForeignKey("family_group.id"), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_by = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    group = relationship("Group", foreign_keys=[group_id])
    creator = relationship("User", foreign_keys=[created_by])
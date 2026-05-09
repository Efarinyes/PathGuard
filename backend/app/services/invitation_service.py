import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy.orm import Session
from app.db.models.invitation import InvitationCode
from app.api.users.models import User

logger = logging.getLogger(__name__)

INVITATION_CODE_LENGTH = 6
INVITATION_EXPIRY_HOURS = 24


class InvitationService:
    @staticmethod
    def generate_code() -> str:
        """Generate a random 6-character alphanumeric code."""
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return "".join(secrets.choice(chars) for _ in range(INVITATION_CODE_LENGTH))

    @staticmethod
    def generate_invitation(
        db: Session,
        email: str,
        created_by_user_id: int,
        group_id: int
    ) -> dict[str, Any]:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise ValueError("User with this email already exists")

        code = InvitationService.generate_code()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRY_HOURS)

        invitation = InvitationCode(
            code=code,
            email=email,
            group_id=group_id,
            created_by=created_by_user_id,
            expires_at=expires_at
        )
        db.add(invitation)
        db.commit()
        db.refresh(invitation)

        logger.info(f"Invitation code generated: {code} for {email}")

        return {
            "code": code,
            "expires_in": INVITATION_EXPIRY_HOURS * 3600,
            "email": email
        }

    @staticmethod
    def validate_code(db: Session, code: str) -> InvitationCode | None:
        invitation = db.query(InvitationCode).filter(
            InvitationCode.code == code
        ).first()

        if not invitation:
            return None

        if invitation.used:
            return None

        if invitation.expires_at < datetime.now(timezone.utc):
            return None

        return invitation

    @staticmethod
    def mark_as_used(db: Session, invitation: InvitationCode) -> None:
        invitation.used = True
        db.commit()


invitation_service = InvitationService()
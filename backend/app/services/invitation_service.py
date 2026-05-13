import logging
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy.orm import Session
from app.db.models.invitation import InvitationCode
from app.api.users.models import User
from app.db.models.group import Group
from app.core.security.password import hash_password
from app.core.security.auth import create_access_token
from app.core.config.settings import settings

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
    def _hash_code(code: str) -> str:
        """Deterministically hash the code using SHA-256."""
        return hashlib.sha256(code.encode()).hexdigest()

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
        hashed_code = InvitationService._hash_code(code)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRY_HOURS)

        invitation = InvitationCode(
            code=hashed_code,
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
        hashed_code = InvitationService._hash_code(code)
        invitation = db.query(InvitationCode).filter(
            InvitationCode.code == hashed_code
        ).first()

        if not invitation:
            return None

        if invitation.used:
            return None

        expires_at = invitation.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < datetime.now(timezone.utc):
            return None

        return invitation

    @staticmethod
    def mark_as_used(db: Session, invitation: InvitationCode) -> None:
        invitation.used = True
        db.commit()

    @staticmethod
    def accept_invitation(
        db: Session,
        code: str,
        password: str
    ) -> dict[str, Any]:
        invitation = InvitationService.validate_code(db, code)
        if not invitation:
            raise ValueError("Invalid or expired invitation code")

        new_user = User(
            email=invitation.email,
            hashed_password=hash_password(password),
            is_caregiver=True,
            is_active=True,
            is_owner=False,
            group_id=invitation.group_id
        )
        db.add(new_user)
        InvitationService.mark_as_used(db, invitation)
        db.commit()
        db.refresh(new_user)

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        jwt = create_access_token(
            new_user.id, expires_delta=access_token_expires
        )

        logger.info(f"User {new_user.email} accepted invitation code {code}")

        return {
            "access_token": jwt,
            "token_type": "bearer"
        }

    @staticmethod
    def check_invitation(
        db: Session,
        code: str
    ) -> dict[str, Any]:
        invitation = InvitationService.validate_code(db, code)
        
        if not invitation:
            return {
                "valid": False,
                "email": None,
                "group_name": None
            }

        group = db.query(Group).filter(Group.id == invitation.group_id).first()
        
        return {
            "valid": True,
            "email": invitation.email,
            "group_name": group.name if group else None
        }


invitation_service = InvitationService()
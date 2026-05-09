from typing import Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID

class RegisterRequest(BaseModel):
    patient_name: str
    group_name: Optional[str] = None
    email: EmailStr
    password: str

class RegisterResponse(BaseModel):
    device_token: UUID
    patient_id: int
    caregiver_jwt: str
    is_owner: bool = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[int] = None

class GenerateInvitationRequest(BaseModel):
    email: EmailStr

class GenerateInvitationResponse(BaseModel):
    code: str
    expires_in: int
    email: str

class AcceptInvitationRequest(BaseModel):
    code: str
    password: str

class AcceptInvitationResponse(BaseModel):
    access_token: str
    token_type: str

class CheckInvitationResponse(BaseModel):
    valid: bool
    email: str | None = None
    group_name: str | None = None

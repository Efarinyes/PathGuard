from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class RegisterRequest(BaseModel):
    patient_name: str
    group_name: Optional[str] = None
    email: EmailStr
    password: str = Field(..., max_length=72)
    sos_enabled: bool = False

class RegisterResponse(BaseModel):
    device_token: str
    patient_id: int
    caregiver_jwt: str
    is_owner: bool = True
    activation_code: str

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
    password: str = Field(..., max_length=72)

class AcceptInvitationResponse(BaseModel):
    access_token: str
    token_type: str

class CheckInvitationResponse(BaseModel):
    valid: bool
    email: str | None = None
    group_name: str | None = None

class UserGroupInfo(BaseModel):
    patient_name: str
    group_name: str
    is_owner: bool
    sos_enabled: bool

class ActivateDeviceRequest(BaseModel):
    code: str

class ActivateDeviceResponse(BaseModel):
    device_token: str
    patient_id: int

class ActivationCodeResponse(BaseModel):
    activation_code: str
    is_used: bool
    expires_at: str | None = None

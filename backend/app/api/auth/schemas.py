from typing import Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID

class RegisterRequest(BaseModel):
    patient_name: str
    email: EmailStr
    password: str

class RegisterResponse(BaseModel):
    device_token: UUID
    patient_id: int
    caregiver_id: int
    group_id: int

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[int] = None

from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID

class CaregiverCreate(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    patient_name: str
    caregivers: List[CaregiverCreate]

class RegisterResponse(BaseModel):
    patient_id: int
    device_token: UUID

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[int] = None

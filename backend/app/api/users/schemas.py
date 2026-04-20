from typing import Optional
from pydantic import BaseModel, EmailStr

# Shared properties
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_caregiver: bool = False
    is_active: bool = True

# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    password: str

# Properties to receive via API on update
class UserUpdate(UserBase):
    password: Optional[str] = None

class User(UserBase):
    id: Optional[int] = None

    class Config:
        from_attributes = True

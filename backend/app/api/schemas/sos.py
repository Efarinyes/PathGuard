from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SOSAlertPayload(BaseModel):
    group_id: int
    walk_id: Optional[int]
    patient_id: int
    sos_count: int
    timestamp: str


class SOSResponse(BaseModel):
    success: bool
    sos_count: int
    message: str
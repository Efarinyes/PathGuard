from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LocationCreate(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    walk_id: int
    client_id: Optional[str] = None
    is_recovered: Optional[bool] = False


class LocationBatch(BaseModel):
    walk_id: int
    batch_id: str
    points: list[LocationCreate]
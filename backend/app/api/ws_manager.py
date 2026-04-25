import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.db.session.database import SessionLocal
from app.core.security.jwt import verify_token
from app.api.users.models import User
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.db.models.location import Location
from app.db.state import walk_state_cache

router = APIRouter()

class ConnectionManager:
    """
    Manages WebSocket connections with strict Group-based isolation.
    Connections are registered into rooms scoped by group_id.
    """
    def __init__(self):
        # group_id -> list of active websockets
        self.group_rooms: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, group_id: int):
        await websocket.accept()
        if group_id not in self.group_rooms:
            self.group_rooms[group_id] = []
        self.group_rooms[group_id].append(websocket)
        
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection_established",
            "group_id": group_id,
            "timestamp": f"{datetime.utcnow().isoformat()}Z"
        })

    def disconnect(self, websocket: WebSocket, group_id: int):
        if group_id in self.group_rooms:
            if websocket in self.group_rooms[group_id]:
                self.group_rooms[group_id].remove(websocket)
            if not self.group_rooms[group_id]:
                del self.group_rooms[group_id]

    async def broadcast_to_group(self, group_id: int, message: dict):
        """
        Sends a message ONLY to the specified group channel.
        Enforces standardized payload format.
        """
        if group_id not in self.group_rooms:
            return
            
        # Standardize payload
        message.setdefault("group_id", group_id)
        if "timestamp" not in message:
            message["timestamp"] = f"{datetime.utcnow().isoformat()}Z"

        for connection in self.group_rooms[group_id]:
            try:
                await connection.send_json(message)
            except Exception:
                # Cleanup is handled by the websocket_endpoint loop
                pass

manager = ConnectionManager()

def authenticate_ws(db: Session, token: Optional[str], patient_token: Optional[str]) -> Tuple[Optional[int], Optional[str]]:
    """
    Helper to authenticate WS connection via JWT (caregiver) or device_token (patient).
    Returns (group_id, role)
    """
    if token:
        user_id = verify_token(token)
        if user_id:
            user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
            if user:
                return user.group_id, "caregiver"
    
    if patient_token:
        try:
            token_uuid = uuid.UUID(patient_token)
            patient = db.query(Patient).filter(Patient.device_token == token_uuid).first()
            if patient:
                return patient.group_id, "patient"
        except ValueError:
            pass
            
    return None, None

@router.websocket("/")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    patient_token: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db)
):
    """
    Main WebSocket entry point. Handles authentication, group scoping, and rehydration.
    """
    group_id, role = authenticate_ws(db, token, patient_token)
    
    if group_id is None:
        await websocket.close(code=4003) # Forbidden
        return

    await manager.connect(websocket, group_id)
    
    # Rehydration: Send active state to connecting caregivers
    if role == "caregiver":
        # Find active walk for this group
        active_walk = db.query(Walk).filter(
            Walk.active == True, 
            Walk.patient_id == db.query(Patient.id).filter(Patient.group_id == group_id).scalar_subquery()
        ).first()
        
        if active_walk:
            cached = walk_state_cache.get(active_walk.id)
            if cached:
                await websocket.send_json({
                    "type": "snapshot",
                    "active_walk_id": active_walk.id,
                    "latest_location": cached["latest"],
                    "history": cached["history"]
                })
            else:
                # DB Fallback
                history = db.query(Location)\
                    .filter(Location.walk_id == active_walk.id)\
                    .order_by(Location.timestamp.desc())\
                    .limit(50).all()
                history.reverse()
                history_dicts = [{"latitude": loc.latitude, "longitude": loc.longitude, "timestamp": loc.timestamp.isoformat()} for loc in history]
                await websocket.send_json({
                    "type": "snapshot",
                    "active_walk_id": active_walk.id,
                    "latest_location": history_dicts[-1] if history_dicts else None,
                    "history": history_dicts
                })

    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, group_id)
    except Exception:
        manager.disconnect(websocket, group_id)

@router.get("/")
def check_ws_status():
    return {"status": "active", "rooms": len(manager.group_rooms)}

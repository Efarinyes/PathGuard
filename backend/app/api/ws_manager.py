import uuid
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Set
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
        self.group_rooms: Dict[int, List[WebSocket]] = {}
        self.patient_connections: Dict[int, Set[WebSocket]] = {}
        self.patient_status: Dict[int, str] = {}
        self.patient_device_status: Dict[int, dict] = {}
        self.caregivers: Dict[int, Set[int]] = {}  # group_id -> set of user_ids
        self.websocket_to_user: Dict[WebSocket, int] = {}  # websocket -> user_id
        self.websocket_to_group: Dict[WebSocket, int] = {}  # websocket -> group_id

    async def connect(self, websocket: WebSocket, group_id: int, role: str, user_id: Optional[int] = None):
        await websocket.accept()
        if group_id not in self.group_rooms:
            self.group_rooms[group_id] = []
        self.group_rooms[group_id].append(websocket)
        
        self.websocket_to_group[websocket] = group_id
        
        if role == "caregiver" and user_id:
            self.websocket_to_user[websocket] = user_id
            if group_id not in self.caregivers:
                self.caregivers[group_id] = set()
            self.caregivers[group_id].add(user_id)
        
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection_established",
            "group_id": group_id,
            "timestamp": f"{datetime.now(timezone.utc).isoformat()}Z"
        })
        
        if role == "patient":
            if group_id not in self.patient_connections:
                self.patient_connections[group_id] = set()
            self.patient_connections[group_id].add(websocket)

    def disconnect(self, websocket: WebSocket, group_id: int, role: str):
        user_id = self.websocket_to_user.pop(websocket, None)
        self.websocket_to_group.pop(websocket, None)
        
        if group_id in self.group_rooms:
            if websocket in self.group_rooms[group_id]:
                self.group_rooms[group_id].remove(websocket)
            if not self.group_rooms[group_id]:
                del self.group_rooms[group_id]
        
        if role == "patient" and group_id in self.patient_connections:
            self.patient_connections[group_id].discard(websocket)
        
        if role == "caregiver" and user_id and group_id in self.caregivers:
            # Only remove user from watchers if they have no other active connections
            is_still_connected = any(uid == user_id for uid in self.websocket_to_user.values())
            if not is_still_connected:
                self.caregivers[group_id].discard(user_id)

    def get_watchers_count(self, group_id: int) -> int:
        """Return number of caregivers watching this group."""
        return len(self.caregivers.get(group_id, set()))

    async def broadcast_watchers_update(self, group_id: int):
        """Broadcast watcher count to all clients in group."""
        count = self.get_watchers_count(group_id)
        await self.broadcast_to_group(group_id, {
            "type": "watchers_update",
            "count": count
        })

    async def broadcast_to_group(self, group_id: int, message: dict):
        """
        Sends a message ONLY to the specified group channel.
        Enforces standardized payload format and includes unique event_id for deduplication.
        """
        if group_id not in self.group_rooms:
            return
            
        # Standardize payload and ensure unique event_id
        message.setdefault("group_id", group_id)
        if "event_id" not in message:
            message["event_id"] = str(uuid.uuid4())
            
        if "timestamp" not in message:
            message["timestamp"] = f"{datetime.utcnow().isoformat()}Z"

        for connection in self.group_rooms[group_id]:
            try:
                await connection.send_json(message)
            except Exception:
                # Cleanup is handled by the websocket_endpoint loop
                pass

manager = ConnectionManager()

def authenticate_ws(db: Session, token: Optional[str], patient_token: Optional[str]) -> Tuple[Optional[int], Optional[str], Optional[int]]:
    """
    Helper to authenticate WS connection via JWT (caregiver) or device_token (patient).
    Returns (group_id, role, user_id)
    """
    if token:
        user_id_raw = verify_token(token)
        if user_id_raw:
            try:
                user_id = int(user_id_raw)
                user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
                if user:
                    return user.group_id, "caregiver", user_id
            except (ValueError, TypeError):
                pass
    
    if patient_token:
        try:
            token_uuid = uuid.UUID(patient_token)
            patient = db.query(Patient).filter(Patient.device_token == token_uuid).first()
            if patient:
                return patient.group_id, "patient", None
        except ValueError:
            pass
            
    return None, None, None

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
    group_id, role, user_id = authenticate_ws(db, token, patient_token)
    
    if group_id is None:
        await websocket.close(code=4003) # Forbidden
        return

    await manager.connect(websocket, group_id, role, user_id)
    
    # Broadcast watchers count after new caregiver connects
    if role == "caregiver":
        print(f"[WS] Caregiver {user_id} connected to group {group_id}")
        await manager.broadcast_watchers_update(group_id)
    
    # ⚡ LATE JOIN CONSISTENCY: Send atomic snapshot as first message
    if role == "caregiver":
        # Find active walk for this group
        active_walk = db.query(Walk).filter(
            Walk.active == True, 
            Walk.patient_id == db.query(Patient.id).filter(Patient.group_id == group_id).scalar_subquery()
        ).first()
        
        if active_walk:
            cached = walk_state_cache.get(active_walk.id)
            snapshot_payload = {
                "type": "snapshot",
                "group_id": group_id,
                "watchers_count": manager.get_watchers_count(group_id),
                "server_timestamp": f"{datetime.now(timezone.utc).isoformat()}Z",
                "active_walk": {
                    "id": active_walk.id,
                    "patient_id": active_walk.patient_id,
                    "start_time": f"{active_walk.start_time.isoformat()}Z",
                    "status": "active"
                },
                "device_status": manager.patient_device_status.get(group_id)
            }
            
            if cached:
                snapshot_payload["active_walk"]["latest_location"] = cached["latest"]
                snapshot_payload["active_walk"]["history"] = cached["history"]
            else:
                # DB Fallback
                history = db.query(Location)\
                    .filter(Location.walk_id == active_walk.id)\
                    .order_by(Location.timestamp.desc())\
                    .limit(50).all()
                history.reverse()
                history_dicts = [{"latitude": loc.latitude, "longitude": loc.longitude, "timestamp": f"{loc.timestamp.isoformat()}Z"} for loc in history]
                snapshot_payload["active_walk"]["latest_location"] = history_dicts[-1] if history_dicts else None
                snapshot_payload["active_walk"]["history"] = history_dicts
            
            await websocket.send_json(snapshot_payload)
        else:
            await websocket.send_json({
                "type": "snapshot",
                "group_id": group_id,
                "watchers_count": manager.get_watchers_count(group_id),
                "active_walk": None,
                "device_status": manager.patient_device_status.get(group_id),
                "server_timestamp": datetime.now(timezone.utc).isoformat()
            })

    try:
        # Notify group when patient presence changes
        if role == "patient":
            manager.patient_status[group_id] = "online"
            await manager.broadcast_to_group(group_id, {"type": "patient_online"})

        while True:
            if role == "patient":
                try:
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=12.0)
                    if data.get("type") == "heartbeat":
                        if manager.patient_status.get(group_id) != "online":
                            manager.patient_status[group_id] = "online"
                            await manager.broadcast_to_group(group_id, {"type": "patient_online"})
                    elif data.get("type") == "device_status_update":
                        # Store and broadcast device status (battery, etc)
                        manager.patient_device_status[group_id] = {
                            "battery_level": data.get("battery_level"),
                            "is_charging": data.get("is_charging"),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        await manager.broadcast_to_group(group_id, {
                            "type": "device_status_update",
                            "status": manager.patient_device_status[group_id]
                        })
                except asyncio.TimeoutError:
                    if manager.patient_status.get(group_id) == "online":
                        manager.patient_status[group_id] = "offline"
                        await manager.broadcast_to_group(group_id, {"type": "patient_offline"})
            else:
                # Caregiver
                await websocket.receive_text()
    except (WebSocketDisconnect, Exception) as e:
        print(f"[WS] Disconnect/Error for {role} in group {group_id}: {str(e)}")
        manager.disconnect(websocket, group_id, role)
        
        # Broadcast watchers count after caregiver disconnects
        if role == "caregiver":
            await manager.broadcast_watchers_update(group_id)
            
        if role == "patient":
            if not manager.patient_connections.get(group_id):
                if manager.patient_status.get(group_id) == "online":
                    manager.patient_status[group_id] = "offline"
                    await manager.broadcast_to_group(group_id, {"type": "patient_offline"})

@router.get("/")
def check_ws_status():
    return {"status": "active", "rooms": len(manager.group_rooms)}

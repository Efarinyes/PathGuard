import uuid
import logging
from typing import Dict, List, Set, Optional, Tuple
from datetime import datetime, timezone
from fastapi import WebSocket
from app.core.utils import format_timestamp_utc
from app.core.constants import HEARTBEAT_TIMEOUT_SECONDS, MAX_LOCATION_HISTORY

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.group_rooms: Dict[int, List[WebSocket]] = {}
        self.patient_connections: Dict[int, Set[WebSocket]] = {}
        self.caregivers: Dict[int, Set[int]] = {}
        self.websocket_to_user: Dict[WebSocket, int] = {}
        self.websocket_to_group: Dict[WebSocket, int] = {}
        self._patient_status_store: Dict[int, str] = {}
        self.last_http_location_at: Dict[int, datetime] = {}

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

        await websocket.send_json({
            "type": "connection_established",
            "group_id": group_id,
            "timestamp": format_timestamp_utc(datetime.now(timezone.utc))
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
            is_still_connected = any(uid == user_id for uid in self.websocket_to_user.values())
            if not is_still_connected:
                self.caregivers[group_id].discard(user_id)

    def get_watchers_count(self, group_id: int) -> int:
        return len(self.caregivers.get(group_id, set()))

    async def broadcast_watchers_update(self, group_id: int):
        count = self.get_watchers_count(group_id)
        await self.broadcast_to_group(group_id, {
            "type": "watchers_update",
            "count": count
        })

    async def broadcast_to_group(self, group_id: int, message: dict):
        if group_id not in self.group_rooms:
            return

        message.setdefault("group_id", group_id)
        if "event_id" not in message:
            message["event_id"] = str(uuid.uuid4())
        if "timestamp" not in message:
            message["timestamp"] = format_timestamp_utc(datetime.now(timezone.utc))

        for connection in self.group_rooms[group_id]:
            try:
                await connection.send_json(message)
            except Exception:
                pass

    @property
    def patient_status(self) -> Dict[int, str]:
        return self._patient_status_store

    def set_patient_online(self, group_id: int):
        self._patient_status_store[group_id] = "online"

    def set_patient_offline(self, group_id: int):
        self._patient_status_store[group_id] = "offline"

    def get_patient_status(self, group_id: int) -> str:
        return self._patient_status_store.get(group_id, "offline")

    def update_http_presence(self, group_id: int) -> None:
        """Cridat des de location_service.save_batch() quan arriben dades HTTP."""
        self.last_http_location_at[group_id] = datetime.now(timezone.utc)

    async def broadcast_patient_status(self, group_id: int) -> None:
        status = self.get_presence_status(group_id)
        await self.broadcast_to_group(group_id, {
            "type": "patient_status",
            "status": status,
            "group_id": group_id,
        })

    def get_presence_status(self, group_id: int) -> str:
        """Retorna 'online' | 'gps_online' | 'limbo' | 'offline'"""
        ws_alive = (
            group_id in self.patient_connections
            and len(self.patient_connections[group_id]) > 0
        )
        last_http = self.last_http_location_at.get(group_id)
        now = datetime.now(timezone.utc)

        if ws_alive:
            return "online"

        if last_http:
            diff = (now - last_http).total_seconds()
            if diff < 60:
                return "gps_online"
            if diff < 300:
                return "limbo"

        return "offline"


connection_manager = ConnectionManager()
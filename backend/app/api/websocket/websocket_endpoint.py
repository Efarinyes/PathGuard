import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.api.websocket.connection_manager import ConnectionManager, connection_manager
from app.api.websocket.presence_tracker import PresenceTracker
from app.api.websocket.snapshot_service import SnapshotService
from app.api.websocket.ws_auth import WSAuth
from app.api.websocket.event_publisher import event_publisher
from app.core.constants import HEARTBEAT_TIMEOUT_SECONDS, WS_CLOSE_CODE_UNAUTHORIZED

logger = logging.getLogger(__name__)

router = APIRouter()

snapshot_service = SnapshotService(connection_manager)


@router.websocket("/")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    patient_token: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db)
):
    group_id, role, user_id = WSAuth.authenticate(db, token, patient_token)

    if group_id is None:
        await websocket.close(code=WS_CLOSE_CODE_UNAUTHORIZED)
        return

    await connection_manager.connect(websocket, group_id, role, user_id)

    if role == "caregiver":
        logger.info("Caregiver %s connected to group %s", user_id, group_id)
        await connection_manager.broadcast_watchers_update(group_id)
        await snapshot_service.send_snapshot(websocket, db, group_id)

    try:
        if role == "patient":
            await _handle_patient_loop(websocket, group_id)
        else:
            await websocket.receive_text()
    except WebSocketDisconnect as e:
        # Code 1005 = normal client close (no status code received), not an error
        if e.code == 1005:
            logger.info("Connection closed normally for %s in group %s", role, group_id)
        else:
            logger.warning("WebSocket disconnect for %s in group %s: code=%s", role, group_id, e.code)
        connection_manager.disconnect(websocket, group_id, role)
    except Exception as e:
        logger.error("Unexpected error for %s in group %s: %s", role, group_id, str(e))
        connection_manager.disconnect(websocket, group_id, role)

        if role == "caregiver":
            await connection_manager.broadcast_watchers_update(group_id)

        if role == "patient":
            if not connection_manager.patient_connections.get(group_id):
                if PresenceTracker.get_patient_status(group_id) == "online":
                    PresenceTracker.set_patient_offline(group_id)
                    await connection_manager.broadcast_to_group(group_id, {"type": "patient_offline"})


async def _handle_patient_loop(websocket: WebSocket, group_id: int):
    while True:
        try:
            data = await asyncio.wait_for(websocket.receive_json(), timeout=HEARTBEAT_TIMEOUT_SECONDS)

            if data.get("type") == "heartbeat":
                if PresenceTracker.get_patient_status(group_id) != "online":
                    PresenceTracker.set_patient_online(group_id)
                    await connection_manager.broadcast_to_group(group_id, {"type": "patient_online"})

        except asyncio.TimeoutError:
            if PresenceTracker.get_patient_status(group_id) == "online":
                PresenceTracker.set_patient_offline(group_id)
                await connection_manager.broadcast_to_group(group_id, {"type": "patient_offline"})


@router.get("/")
def check_ws_status():
    return {"status": "active", "rooms": len(connection_manager.group_rooms)}
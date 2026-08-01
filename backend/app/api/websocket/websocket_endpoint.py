import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.api.websocket.connection_manager import ConnectionManager, connection_manager
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

    if role == "patient":
        connection_manager.set_patient_online(group_id)
        await connection_manager.broadcast_to_group(group_id, {"type": "patient_online"})
        await connection_manager.broadcast_patient_status(group_id)

    try:
        if role == "patient":
            await _handle_patient_loop(websocket, group_id)
        else:
            await websocket.receive_text()
    except WebSocketDisconnect as e:
        if e.code == 1005:
            logger.info("Connection closed normally for %s in group %s", role, group_id)
        else:
            logger.warning("WebSocket disconnect for %s in group %s: code=%s", role, group_id, e.code)
        await _on_socket_gone(websocket, group_id, role)
    except Exception as e:
        logger.error("Unexpected error for %s in group %s: %s", role, group_id, str(e))
        await _on_socket_gone(websocket, group_id, role)


async def _on_socket_gone(websocket: WebSocket, group_id: int, role: str) -> None:
    """Remove socket and emit honest 4-state presence (not hard patient_offline)."""
    connection_manager.disconnect(websocket, group_id, role)

    if role == "caregiver":
        await connection_manager.broadcast_watchers_update(group_id)
        return

    if role == "patient" and not connection_manager.patient_connections.get(group_id):
        connection_manager.set_patient_offline(group_id)
        await connection_manager.broadcast_patient_status(group_id)


async def _handle_patient_loop(websocket: WebSocket, group_id: int):
    while True:
        try:
            data = await asyncio.wait_for(websocket.receive_json(), timeout=HEARTBEAT_TIMEOUT_SECONDS)

            if data.get("type") == "heartbeat":
                connection_manager.set_patient_online(group_id)
                await connection_manager.broadcast_to_group(group_id, {"type": "patient_online"})
                await connection_manager.broadcast_patient_status(group_id)

        except asyncio.TimeoutError:
            # Drop zombie WS so get_presence_status can return gps_online/limbo/offline
            logger.info("Patient heartbeat timeout group=%s — recomputing presence", group_id)
            connection_manager.disconnect(websocket, group_id, "patient")
            if not connection_manager.patient_connections.get(group_id):
                connection_manager.set_patient_offline(group_id)
            await connection_manager.broadcast_patient_status(group_id)
            try:
                await websocket.close()
            except Exception:
                pass
            return


@router.get("/")
def check_ws_status():
    return {"status": "active", "rooms": len(connection_manager.group_rooms)}
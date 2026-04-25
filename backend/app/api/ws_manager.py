from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

class ConnectionManager:
    """
    Manages active WebSocket connections for real-time broadcasting.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """
        Sends a JSON message to all connected clients.
        """
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Handle unexpected connection drops during broadcast
                pass

manager = ConnectionManager()

@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time communication.
    Registers the connection with the global manager to receive broadcasts.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Maintain the connection and listen for any client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
        await websocket.close()

@router.get("/")
def read_websockets():
    return {"message": "WebSockets endpoint is active"}

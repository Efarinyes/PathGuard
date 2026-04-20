from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.api.models.walk import Walk
from app.db.websockets_router import manager
from datetime import datetime, timezone
from app.api.models.patient import Patient
from uuid import uuid4

def test_websocket_connect(client: TestClient) -> None:
    """
    Test that a WebSocket can connect and is registered by the manager.
    """
    initial_count = len(manager.active_connections)
    with client.websocket_connect("/api/v1/ws/") as websocket:
        # Connection should be accepted and added to the manager
        assert len(manager.active_connections) == initial_count + 1
        assert websocket is not None

def test_websocket_disconnect(client: TestClient) -> None:
    """
    Test that a WebSocket is un-registered when it disconnects.
    """
    initial_count = len(manager.active_connections)
    with client.websocket_connect("/api/v1/ws/") as websocket:
        assert len(manager.active_connections) == initial_count + 1
        websocket.close()
        # We need to give the asyncio event loop a moment to handle the disconnect exception
        # But TestClient might not yield yielding control directly since it's synchronous externally.
        # Actually, TestClient's context manager closure handles the disconnect synchronously.
        
    # Once context block ends, connection is closed and manager should have removed it
    assert len(manager.active_connections) == initial_count

def test_websocket_receive_updates(client: TestClient, auth_headers: dict, db: Session, caregiver_user) -> None:
    """
    Test that the WebSocket receives broadcasts when a new location is saved.
    """
    # Ensure caregiver has a patient linked
    if not caregiver_user.patients:
        patient = Patient(name="WS Test Patient", device_token=uuid4())
        caregiver_user.patients.append(patient)
        db.add(caregiver_user)
        db.commit()

    # Create an active walk first to allow saving locations
    walk = Walk(start_time=datetime.now(timezone.utc), active=True, initiated_by_type="caregiver")
    db.add(walk)
    db.commit()
    db.refresh(walk)

    # Open WebSocket
    with client.websocket_connect("/api/v1/ws/") as websocket:
        
        # Post a new location via standard HTTP
        payload = {
            "latitude": 42.123,
            "longitude": 2.456,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "walk_id": walk.id
        }
        
        # We need to make the post request using the same client to trigger the broadcast
        response = client.post("/api/v1/locations/", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        # Now the websocket should have received the exact same data payload JSON
        data = websocket.receive_json()
        assert "latitude" in data
        assert data["latitude"] == 42.123
        assert data["longitude"] == 2.456
        assert data["walk_id"] == walk.id

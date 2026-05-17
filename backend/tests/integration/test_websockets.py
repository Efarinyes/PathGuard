from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db.models.walk import Walk
from app.db.models.patient import Patient
from app.api.users.models import User
from app.api.websocket.connection_manager import connection_manager as manager
from datetime import datetime, timezone
from uuid import uuid4


def test_websocket_connect(client: TestClient, auth_headers: dict) -> None:
    """
    Test that a WebSocket can connect and is registered by the manager.
    Requires authentication — unauthenticated connections are closed with 4003.
    """
    jwt = auth_headers["Authorization"].split(" ")[1]
    initial_count = len(manager.group_rooms)
    with client.websocket_connect(f"/api/v1/ws/?token={jwt}") as websocket:
        assert len(manager.group_rooms) == initial_count + 1
        websocket.receive_json()  # connection_established
        # Now we receive watchers_update before snapshot
        msg = websocket.receive_json()
        if "watchers" in msg.get("type", ""):
            websocket.receive_json()  # snapshot
        assert websocket is not None


def test_websocket_disconnect(client: TestClient, auth_headers: dict) -> None:
    """
    Test that a WebSocket room is cleaned up when the connection closes.
    """
    jwt = auth_headers["Authorization"].split(" ")[1]
    initial_count = len(manager.group_rooms)
    with client.websocket_connect(f"/api/v1/ws/?token={jwt}") as websocket:
        assert len(manager.group_rooms) == initial_count + 1
        websocket.receive_json()  # connection_established
        # Now we receive watchers_update before snapshot
        msg = websocket.receive_json()
        if "watchers" in msg.get("type", ""):
            websocket.receive_json()  # snapshot
        websocket.close()

    assert len(manager.group_rooms) == initial_count


def test_websocket_receive_updates(
    client: TestClient, auth_headers: dict, db: Session,
    caregiver_user: User, group
) -> None:
    """
    Test that a broadcast location event is received over WebSocket.
    """
    jwt = auth_headers["Authorization"].split(" ")[1]

    # Ensure caregiver's group has a patient
    patient = db.query(Patient).filter(Patient.group_id == caregiver_user.group_id).first()
    if not patient:
        patient = Patient(
            name="WS Test Patient",
            device_token=uuid4(),
            group_id=caregiver_user.group_id
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    # Create an active walk linked to that patient
    walk = Walk(
        start_time=datetime.now(timezone.utc),
        active=True,
        initiated_by_type="caregiver",
        patient_id=patient.id
    )
    db.add(walk)
    db.commit()
    db.refresh(walk)

    with client.websocket_connect(f"/api/v1/ws/?token={jwt}") as websocket:
        websocket.receive_json()  # connection_established
        # Now we receive watchers_update before snapshot
        msg = websocket.receive_json()
        if "watchers" in msg.get("type", ""):
            websocket.receive_json()  # snapshot

        payload = {
            "latitude": 42.123,
            "longitude": 2.456,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "walk_id": walk.id
        }

        response = client.post("/api/v1/locations/", json=payload, headers=auth_headers)
        assert response.status_code == 200

        data = websocket.receive_json()
        assert "latitude" in data
        assert data["latitude"] == 42.123
        assert data["longitude"] == 2.456
        assert data["walk_id"] == walk.id

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
from app.db.models.group import Group
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.db.models.location import Location
from app.api.users.models import User
from app.core.security.password import hash_password
from app.core.security.auth import create_access_token

def test_location_batch_expansion_and_broadcast(client: TestClient, db: Session):
    # Setup
    group = Group(name="Batch Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Batch Patient", group_id=group.id)
    db.add(patient)
    user = User(email="batch@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    walk = Walk(patient_id=patient.id, active=True, start_time=datetime.utcnow(), initiated_by_type="patient")
    db.add(walk)
    db.commit()
    
    # 1. Connect Caregiver to WS
    with client.websocket_connect(f"/api/v1/ws/?token={token}") as ws:
        ws.receive_json() # connection_established
        ws.receive_json() # snapshot
        
        # 2. Send BATCH of 3 points
        batch_id = str(uuid.uuid4())
        batch_data = {
            "walk_id": walk.id,
            "batch_id": batch_id,
            "points": [
                {"latitude": 41.1, "longitude": 2.1, "timestamp": datetime.utcnow().isoformat(), "walk_id": walk.id, "client_id": str(uuid.uuid4())},
                {"latitude": 41.2, "longitude": 2.2, "timestamp": datetime.utcnow().isoformat(), "walk_id": walk.id, "client_id": str(uuid.uuid4())},
                {"latitude": 41.3, "longitude": 2.3, "timestamp": datetime.utcnow().isoformat(), "walk_id": walk.id, "client_id": str(uuid.uuid4())}
            ]
        }
        
        response = client.post("/api/v1/locations/batch", json=batch_data, headers=headers)
        assert response.status_code == 200
        assert response.json()["inserted"] == 3
        
        # 3. VERIFY WS RECEIVES 3 INDIVIDUAL EVENTS (Batch Expansion)
        for i in range(3):
            event = ws.receive_json()
            assert event["type"] == "location"
            assert event["walk_id"] == walk.id
            # Points should arrive in order
            assert event["latitude"] == batch_data["points"][i]["latitude"]

        # 4. Verify DB state
        locs = db.query(Location).filter(Location.walk_id == walk.id).all()
        assert len(locs) == 3

def test_batch_atomic_idempotency(client: TestClient, db: Session):
    group = Group(name="Atomic Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Atomic Patient", group_id=group.id)
    db.add(patient)
    user = User(email="atomic@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    walk = Walk(patient_id=patient.id, active=True, start_time=datetime.utcnow(), initiated_by_type="patient")
    db.add(walk)
    db.commit()
    
    client_id_shared = str(uuid.uuid4())
    batch_data = {
        "walk_id": walk.id,
        "batch_id": "batch-1",
        "points": [
            {"latitude": 50.1, "longitude": 10.1, "timestamp": datetime.utcnow().isoformat(), "walk_id": walk.id, "client_id": client_id_shared},
            {"latitude": 50.2, "longitude": 10.2, "timestamp": datetime.utcnow().isoformat(), "walk_id": walk.id, "client_id": str(uuid.uuid4())}
        ]
    }
    
    # Send first time
    client.post("/api/v1/locations/batch", json=batch_data, headers={"Authorization": f"Bearer {token}"})
    
    # Send again (with one overlapping client_id)
    response = client.post("/api/v1/locations/batch", json=batch_data, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["inserted"] == 0 # None should be inserted because all client_ids already exist

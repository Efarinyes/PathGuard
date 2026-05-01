import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
from app.db.models.group import Group
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.api.users.models import User
from app.core.security.password import hash_password
from app.core.security.auth import create_access_token

def test_websocket_event_id_deduplication(client: TestClient, db: Session):
    # Setup
    group = Group(name="Dedupe Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Dedupe Patient", group_id=group.id)
    db.add(patient)
    user = User(email="dedupe@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    
    with client.websocket_connect(f"/api/v1/ws/?token={token}") as ws:
        ws.receive_json() # connection_established
        
        # Trigger walk start
        headers = {"Authorization": f"Bearer {token}"}
        client.post("/api/v1/walks/start", headers=headers)
        
        event = ws.receive_json()
        assert "event_id" in event
        assert event["type"] == "walk_started"
        
        event_id_1 = event["event_id"]
        
        # Trigger location update
        walk_id = event["walk_id"]
        loc_data = {
            "latitude": 41.5,
            "longitude": 2.5,
            "timestamp": datetime.utcnow().isoformat(),
            "walk_id": walk_id
        }
        client.post("/api/v1/locations", json=loc_data, headers=headers)
        
        event2 = ws.receive_json()
        assert "event_id" in event2
        assert event2["event_id"] != event_id_1
        assert event2["type"] == "location"

def test_websocket_broadcast_standardization(client: TestClient, db: Session):
    # Verify that all broadcasted events have group_id and timestamp
    group = Group(name="Standard Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Standard Patient", group_id=group.id)
    db.add(patient)
    user = User(email="std@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    
    with client.websocket_connect(f"/api/v1/ws/?token={token}") as ws:
        ws.receive_json() # connection_established
        
        client.post("/api/v1/walks/start", headers={"Authorization": f"Bearer {token}"})
        event = ws.receive_json()
        
        assert "group_id" in event
        assert "timestamp" in event
        assert "event_id" in event
        assert event["group_id"] == group.id

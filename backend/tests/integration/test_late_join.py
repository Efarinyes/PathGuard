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

def test_late_join_ws_snapshot(client: TestClient, db: Session):
    # 1. Setup Environment
    group = Group(name="Late Join Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Late Join Patient", group_id=group.id)
    db.add(patient)
    user = User(email="late@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    
    # 2. Start Walk and add 2 locations BEFORE caregiver connects
    walk = Walk(patient_id=patient.id, active=True, start_time=datetime.utcnow(), initiated_by_type="patient")
    db.add(walk)
    db.flush()
    
    loc1 = Location(walk_id=walk.id, latitude=41.1, longitude=2.1, timestamp=datetime.utcnow())
    loc2 = Location(walk_id=walk.id, latitude=41.2, longitude=2.2, timestamp=datetime.utcnow())
    db.add(loc1)
    db.add(loc2)
    db.commit()
    
    # 3. Caregiver joins late via WebSocket
    with client.websocket_connect(f"/api/v1/ws/?token={token}") as ws:
        # 3a. Connection established
        msg1 = ws.receive_json()
        assert msg1["type"] == "connection_established"
        
        # 3b. Atomic Snapshot (Late Join Consistency)
        msg2 = ws.receive_json()
        assert msg2["type"] == "snapshot"
        assert msg2["active_walk"] is not None
        assert msg2["active_walk"]["id"] == walk.id
        assert len(msg2["active_walk"]["history"]) == 2
        assert msg2["active_walk"]["latest_location"]["latitude"] == 41.2
        
        # 4. Ensure next live event is incremental
        loc3_data = {
            "latitude": 41.3,
            "longitude": 2.3,
            "timestamp": datetime.utcnow().isoformat(),
            "walk_id": walk.id
        }
        client.post("/api/v1/locations", json=loc3_data, headers={"Authorization": f"Bearer {token}"})
        
        msg3 = ws.receive_json()
        assert msg3["type"] == "location"
        assert msg3["latitude"] == 41.3

def test_late_join_no_walk(client: TestClient, db: Session):
    group = Group(name="No Walk Family")
    db.add(group)
    db.flush()
    patient = Patient(name="No Walk Patient", group_id=group.id)
    db.add(patient)
    user = User(email="nowalk@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    
    with client.websocket_connect(f"/api/v1/ws/?token={token}") as ws:
        ws.receive_json() # connection_established
        msg = ws.receive_json() # snapshot
        assert msg["type"] == "snapshot"
        assert msg["active_walk"] is None

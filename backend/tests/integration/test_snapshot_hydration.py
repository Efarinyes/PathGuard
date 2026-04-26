import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.models.group import Group
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.db.models.location import Location
from app.api.users.models import User
from app.core.security.password import hash_password
from app.core.security.auth import create_access_token

def test_snapshot_rehydration_consistency(client: TestClient, db: Session):
    # 1. Setup Environment
    group = Group(name="Snapshot Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Snapshot Patient", group_id=group.id)
    db.add(patient)
    user = User(email="snap@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Create Active Walk with some history
    walk = Walk(patient_id=patient.id, active=True, start_time=datetime.utcnow(), initiated_by_type="patient")
    db.add(walk)
    db.flush()
    
    loc1 = Location(walk_id=walk.id, latitude=41.1, longitude=2.1, timestamp=datetime.utcnow())
    db.add(loc1)
    db.commit()
    
    # 3. VERIFY SNAPSHOT ENDPOINT
    response = client.get("/api/v1/walks/active", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    assert data["active_walk"] is not None
    assert data["active_walk"]["id"] == walk.id
    assert len(data["active_walk"]["history"]) == 1
    assert data["active_walk"]["latest_location"]["latitude"] == 41.1
    
    # 4. VERIFY WEBSOCKET INCREMENTAL RULE
    # The WS should NOT resend the history. It should only send "connection_established" and wait for NEW events.
    with client.websocket_connect(f"/api/v1/ws/?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "connection_established"
        
        # Ensure no snapshot follows (since we now rely on REST for initial hydration)
        with pytest.raises(Exception):
            ws.receive_json(timeout=0.1)
            
        # 5. Trigger NEW location update and verify it arrives via WS
        loc2_data = {
            "latitude": 41.2,
            "longitude": 2.2,
            "timestamp": datetime.utcnow().isoformat(),
            "walk_id": walk.id
        }
        response = client.post("/api/v1/locations", json=loc2_data, headers=headers)
        assert response.status_code == 200
        
        event = ws.receive_json()
        assert event["type"] == "location"
        assert event["latitude"] == 41.2

def test_no_active_walk_returns_null(client: TestClient, db: Session):
    group = Group(name="Empty Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Empty Patient", group_id=group.id)
    db.add(patient)
    user = User(email="empty@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.get("/api/v1/walks/active", headers=headers)
    assert response.status_code == 200
    assert response.json()["active_walk"] is None

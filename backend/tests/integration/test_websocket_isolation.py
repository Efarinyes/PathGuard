import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.models.group import Group
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.api.users.models import User
from app.core.security.password import hash_password
from app.core.security.auth import create_access_token

def test_websocket_isolation(client: TestClient, db: Session):
    # 1. Setup Group A
    group_a = Group(name="Family A")
    db.add(group_a)
    db.flush()
    patient_a = Patient(name="Patient A", group_id=group_a.id)
    db.add(patient_a)
    caregiver_a = User(email="a_ws@example.com", hashed_password=hash_password("pw"), group_id=group_a.id, is_caregiver=True)
    db.add(caregiver_a)
    
    # 2. Setup Group B
    group_b = Group(name="Family B")
    db.add(group_b)
    db.flush()
    patient_b = Patient(name="Patient B", group_id=group_b.id)
    db.add(patient_b)
    caregiver_b = User(email="b_ws@example.com", hashed_password=hash_password("pw"), group_id=group_b.id, is_caregiver=True)
    db.add(caregiver_b)
    
    db.commit()
    
    token_a = create_access_token(caregiver_a.id)
    token_b = create_access_token(caregiver_b.id)

    # 3. Connect both caregivers
    with client.websocket_connect(f"/api/v1/ws/?token={token_a}") as ws_a:
        msg_a = ws_a.receive_json()
        assert msg_a["type"] == "connection_established"
        assert msg_a["group_id"] == group_a.id
        
        with client.websocket_connect(f"/api/v1/ws/?token={token_b}") as ws_b:
            msg_b = ws_b.receive_json()
            assert msg_b["type"] == "connection_established"
            assert msg_b["group_id"] == group_b.id
            
            # 4. Trigger event in Group A (Start Walk)
            # Use the /start endpoint
            headers_a = {"Authorization": f"Bearer {token_a}"}
            response = client.post("/api/v1/walks/start", headers=headers_a)
            assert response.status_code == 200
            walk_id = response.json()
            
            # 5. Verify Caregiver A receives it
            event_a = ws_a.receive_json()
            assert event_a["type"] == "walk_started"
            assert event_a["group_id"] == group_a.id
            assert event_a["walk_id"] == walk_id
            
            # 6. Verify Caregiver B receives NOTHING
            # We check if there's any message for B (should timeout or stay empty)
            with pytest.raises(Exception): # TestClient raises error on timeout if nothing received
                ws_b.receive_json(timeout=0.1)

def test_websocket_rehydration_on_connect(client: TestClient, db: Session):
    # Setup Group C with an active walk
    group_c = Group(name="Family C")
    db.add(group_c)
    db.flush()
    patient_c = Patient(name="Patient C", group_id=group_c.id)
    db.add(patient_c)
    caregiver_c = User(email="c_ws@example.com", hashed_password=hash_password("pw"), group_id=group_c.id, is_caregiver=True)
    db.add(caregiver_c)
    db.commit()
    
    # Start walk for Patient C
    walk_c = Walk(patient_id=patient_c.id, active=True, start_time=datetime.utcnow(), initiated_by_type="patient")
    db.add(walk_c)
    db.commit()
    
    token_c = create_access_token(caregiver_c.id)
    
    # Connect Caregiver C
    with client.websocket_connect(f"/api/v1/ws/?token={token_c}") as ws_c:
        # 1. Connection established
        msg1 = ws_c.receive_json()
        assert msg1["type"] == "connection_established"
        
        # 2. Snapshot
        msg2 = ws_c.receive_json()
        assert msg2["type"] == "snapshot"
        assert msg2["active_walk_id"] == walk_c.id

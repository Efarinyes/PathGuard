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

def test_location_idempotency(client: TestClient, db: Session):
    # Setup
    group = Group(name="Idempotency Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Idempotency Patient", group_id=group.id)
    db.add(patient)
    user = User(email="idemp@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    walk = Walk(patient_id=patient.id, active=True, start_time=datetime.utcnow(), initiated_by_type="patient")
    db.add(walk)
    db.commit()
    
    client_id = str(uuid.uuid4())
    loc_data = {
        "latitude": 41.123,
        "longitude": 2.123,
        "timestamp": datetime.utcnow().isoformat(),
        "walk_id": walk.id,
        "client_id": client_id
    }
    
    # 1. First POST: Created
    response1 = client.post("/api/v1/locations", json=loc_data, headers=headers)
    assert response1.status_code == 200
    assert response1.json()["latitude"] == 41.123
    
    # 2. Second POST (same client_id): Handled gracefully (idempotent)
    response2 = client.post("/api/v1/locations", json=loc_data, headers=headers)
    assert response2.status_code == 200 # We return 200 but with status: already_synced
    assert response2.json()["status"] == "already_synced"
    
    # 3. Verify only ONE record in DB
    locs = db.query(Location).filter(Location.client_id == client_id).all()
    assert len(locs) == 1

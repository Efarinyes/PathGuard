import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db.models.group import Group
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.db.models.location import Location
from app.api.users.models import User
from app.core.security.password import hash_password
from app.core.security.auth import create_access_token

def test_walk_stop_integrity_check(client: TestClient, db: Session):
    # Setup
    group = Group(name="Integrity Family")
    db.add(group)
    db.flush()
    patient = Patient(name="Integrity Patient", group_id=group.id)
    db.add(patient)
    user = User(email="integ@example.com", hashed_password=hash_password("pw"), group_id=group.id, is_caregiver=True)
    db.add(user)
    db.commit()
    
    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create a walk with BAD (non-monotonic) points
    walk = Walk(patient_id=patient.id, active=True, start_time=datetime.utcnow(), initiated_by_type="patient")
    db.add(walk)
    db.flush()
    
    now = datetime.utcnow()
    # Point 1
    db.add(Location(walk_id=walk.id, latitude=41, longitude=2, timestamp=now))
    # Point 2: BACK IN TIME
    db.add(Location(walk_id=walk.id, latitude=41, longitude=2, timestamp=now - timedelta(seconds=10)))
    db.commit()
    
    # 2. Stop Walk
    response = client.post("/api/v1/walks/stop", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["integrity"]["is_valid"] == False
    assert data["integrity"]["points_count"] == 2

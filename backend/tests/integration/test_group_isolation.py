import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from datetime import datetime
from app.db.models.group import Group
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.api.users.models import User
from app.core.security.password import hash_password
from app.core.security.auth import create_access_token

def test_group_isolation_enforcement(client: TestClient, db: Session):
    # 1. Setup Group A
    group_a = Group(name="Family A")
    db.add(group_a)
    db.flush()
    patient_a = Patient(name="Patient A", group_id=group_a.id)
    db.add(patient_a)
    caregiver_a = User(email="a@example.com", hashed_password=hash_password("pw"), group_id=group_a.id, is_caregiver=True)
    db.add(caregiver_a)
    
    # 2. Setup Group B
    group_b = Group(name="Family B")
    db.add(group_b)
    db.flush()
    patient_b = Patient(name="Patient B", group_id=group_b.id)
    db.add(patient_b)
    caregiver_b = User(email="b@example.com", hashed_password=hash_password("pw"), group_id=group_b.id, is_caregiver=True)
    db.add(caregiver_b)
    
    db.commit()
    
    # Auth headers
    token_a = create_access_token(caregiver_a.id)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    token_b = create_access_token(caregiver_b.id)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # TEST: Caregiver A tries to access a Walk ID belonging to Patient B
    # Create a finished walk for Patient B
    walk_b = Walk(
        patient_id=patient_b.id, 
        active=False, 
        start_time=datetime.utcnow(), 
        initiated_by_type="patient"
    )
    db.add(walk_b)
    db.commit()
    
    # Should return 404/403 as if it doesn't exist for them
    response = client.get(f"/api/v1/walks/{walk_b.id}/locations", headers=headers_a)
    assert response.status_code == 404
    assert response.json()["detail"] == "Walk not found or access denied"
    
    # Caregiver B can access it
    response = client.get(f"/api/v1/walks/{walk_b.id}/locations", headers=headers_b)
    assert response.status_code == 200

    # TEST: Verify "resolve_patient" logic in /active
    # If Caregiver A calls /active, they should get NO walk (because Patient A has no active walk)
    # Even if Patient B has an active walk.
    walk_b_active = Walk(
        patient_id=patient_b.id, 
        active=True, 
        start_time=datetime.utcnow(),
        initiated_by_type="caregiver"
    )
    db.add(walk_b_active)
    db.commit()
    
    response = client.get("/api/v1/walks/active", headers=headers_a)
    assert response.status_code == 200
    assert response.json()["active_walk"] is None
    
    # Caregiver B gets the walk
    response = client.get("/api/v1/walks/active", headers=headers_b)
    assert response.status_code == 200
    assert response.json()["active_walk_id"] == walk_b_active.id

    # TEST: Patient B cannot access caregiver-only endpoints (e.g. read_walks list)
    # Wait, read_walks currently allows patients in the code.
    # But let's verify that a patient token for B cannot see A's data.
    patient_token_b = str(patient_b.device_token)
    headers_patient_b = {"X-Patient-Token": patient_token_b}
    
    # Create walk for Patient A
    walk_a = Walk(patient_id=patient_a.id, active=False, start_time=datetime.utcnow(), initiated_by_type="patient")
    db.add(walk_a)
    db.commit()
    
    # Patient B tries to get A's walk locations
    response = client.get(f"/api/v1/walks/{walk_a.id}/locations", headers=headers_patient_b)
    assert response.status_code == 404

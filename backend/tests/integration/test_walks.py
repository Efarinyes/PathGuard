import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.models.patient import Patient
from app.api.users.models import User
from app.api.models.walk import Walk

def test_start_walk_patient_auth(client: TestClient, db: Session):
    # Setup Patient
    token = uuid4()
    patient = Patient(name="Walk Patient", device_token=token)
    db.add(patient)
    db.commit()

    # Clear any active walks just in case
    db.query(Walk).delete()
    db.commit()

    response = client.post(
        "/api/v1/walks/start", 
        headers={"X-Patient-Token": str(token)}
    )
    
    assert response.status_code == 200
    walk_id = response.json()
    
    # Verify DB
    walk = db.query(Walk).filter(Walk.id == walk_id).first()
    assert walk is not None
    assert walk.initiated_by_type == "patient"
    assert walk.active is True

def test_start_walk_caregiver_auth(client: TestClient, db: Session, caregiver_user: User, auth_headers: dict):
    # Attach a patient to caregiver so resolve_patient succeeds
    if not caregiver_user.patients:
        patient = Patient(name="Caregiver's Patient", device_token=uuid4())
        caregiver_user.patients.append(patient)
        db.add(caregiver_user)
        db.commit()

    # Clear any active walks just in case
    db.query(Walk).delete()
    db.commit()

    response = client.post(
        "/api/v1/walks/start", 
        headers=auth_headers
    )
    
    assert response.status_code == 200
    walk_id = response.json()
    
    # Verify DB
    walk = db.query(Walk).filter(Walk.id == walk_id).first()
    assert walk is not None
    assert walk.initiated_by_type == "caregiver"
    assert walk.active is True

def test_start_walk_no_auth(client: TestClient):
    response = client.post("/api/v1/walks/start")
    
    assert response.status_code == 401

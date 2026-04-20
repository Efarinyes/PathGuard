import pytest
from datetime import datetime
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.models.patient import Patient
from app.api.users.models import User
from app.api.models.walk import Walk
from app.api.models.location import Location

def create_active_walk(db: Session, patient: Patient | None = None) -> Walk:
    walk = Walk(
        start_time=datetime.utcnow(),
        active=True,
        initiated_by_type="patient" if patient else "caregiver"
    )
    db.add(walk)
    db.commit()
    db.refresh(walk)
    return walk

def test_location_ingestion_patient_auth(client: TestClient, db: Session):
    # Setup Patient
    token = uuid4()
    patient = Patient(name="Loc Patient", device_token=token)
    db.add(patient)
    db.commit()

    db.query(Walk).delete()
    db.commit()

    # Needs to link to an existing active walk
    walk = create_active_walk(db, patient=patient)

    payload = {
        "latitude": 41.3851,
        "longitude": 2.1734,
        "timestamp": datetime.utcnow().isoformat(),
        "walk_id": walk.id
    }

    response = client.post(
        "/api/v1/locations/", 
        json=payload,
        headers={"X-Patient-Token": str(token)}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["walk_id"] == walk.id
    assert data["latitude"] == 41.3851
    
    # Verify DB row modified
    loc = db.query(Location).filter(Location.id == data["id"]).first()
    assert loc is not None
    assert loc.walk_id == walk.id
    assert loc.latitude == 41.3851

def test_location_ingestion_caregiver_auth(client: TestClient, db: Session, caregiver_user: User, auth_headers: dict):
    if not caregiver_user.patients:
        patient = Patient(name="Caregiver's Loc Patient", device_token=uuid4())
        caregiver_user.patients.append(patient)
        db.add(caregiver_user)
        db.commit()

    db.query(Walk).delete()
    db.commit()

    walk = create_active_walk(db)

    payload = {
        "latitude": 41.3852,
        "longitude": 2.1735,
        "timestamp": datetime.utcnow().isoformat(),
        "walk_id": walk.id
    }

    response = client.post(
        "/api/v1/locations/", 
        json=payload,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["walk_id"] == walk.id

def test_location_ingestion_invalid_token(client: TestClient, db: Session):
    db.query(Walk).delete()
    db.commit()
    walk = create_active_walk(db)

    payload = {
        "latitude": 41.3851,
        "longitude": 2.1734,
        "timestamp": datetime.utcnow().isoformat(),
        "walk_id": walk.id
    }

    # Format ok but token invalid
    response = client.post(
        "/api/v1/locations/", 
        json=payload,
        headers={"X-Patient-Token": str(uuid4())}
    )
    assert response.status_code == 401
    
    # Missing auth
    response2 = client.post(
        "/api/v1/locations/", 
        json=payload
    )
    assert response2.status_code == 401

def test_location_ingestion_invalid_payload(client: TestClient, db: Session):
    token = uuid4()
    patient = Patient(name="Loc Patient 2", device_token=token)
    db.add(patient)
    db.commit()

    db.query(Walk).delete()
    db.commit()
    walk = create_active_walk(db, patient)
    
    # Missing timestamp and walk_id, wrong types
    payload = {
        "latitude": "not-numeric", 
        "longitude": 2.1734
    }

    response = client.post(
        "/api/v1/locations/", 
        json=payload,
        headers={"X-Patient-Token": str(token)}
    )
    
    assert response.status_code == 422

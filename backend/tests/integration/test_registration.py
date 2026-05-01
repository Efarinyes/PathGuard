import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db.models.group import Group
from app.db.models.patient import Patient
from app.api.users.models import User

def test_atomic_registration_flow(client: TestClient, db: Session):
    payload = {
        "patient_name": "Test Patient",
        "email": "caregiver@example.com",
        "password": "securepassword123"
    }
    
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert "device_token" in data
    assert "patient_id" in data
    assert "caregiver_jwt" in data
    
    # Verify DB state
    user = db.query(User).filter(User.email == payload["email"]).first()
    assert user is not None
    assert user.is_caregiver is True
    
    group = db.query(Group).filter(Group.id == user.group_id).first()
    assert group is not None
    assert "Test Patient" in group.name
    
    patient = db.query(Patient).filter(Patient.group_id == group.id).first()
    assert patient is not None
    assert patient.name == "Test Patient"
    assert str(patient.device_token) == data["device_token"]

def test_registration_email_collision(client: TestClient, db: Session):
    payload = {
        "patient_name": "Patient 1",
        "email": "duplicate@example.com",
        "password": "password"
    }
    
    # Register once
    client.post("/api/v1/auth/register", json=payload)
    
    # Register again with same email
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "exists" in response.json()["detail"]

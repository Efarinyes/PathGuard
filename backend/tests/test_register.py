import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.api.models.patient import Patient
from app.api.users.models import User
from app.core.config.settings import settings

def test_register_success(client: TestClient, db: Session):
    """
    Test successful registration with a valid payload.
    Should return 200 and include patient_id and device_token.
    """
    payload = {
        "patient_name": "Test Patient",
        "caregivers": [
            {
                "email": "caregiver1@test.com",
                "password": "securepassword123"
            }
        ]
    }
    
    response = client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert "patient_id" in data
    assert "device_token" in data
    assert isinstance(data["patient_id"], int)
    assert isinstance(data["device_token"], str)

def test_register_db_validation(client: TestClient, db: Session):
    """
    Test that the registration properly persists the Patient and User models
    to the database, and creates the correct many-to-many relationship.
    """
    payload = {
        "patient_name": "John Doe",
        "caregivers": [
            {
                "email": "caregiver_db_test@test.com",
                "password": "testpassword"
            }
        ]
    }
    
    response = client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    patient_id = data["patient_id"]
    
    # 1. Patient created
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    assert patient is not None
    assert patient.name == "John Doe"
    
    # 2. Caregiver created
    caregiver = db.query(User).filter(User.email == "caregiver_db_test@test.com").first()
    assert caregiver is not None
    assert caregiver.is_caregiver is True
    
    # 3. Relationship exists
    assert caregiver in patient.caregivers
    assert patient in caregiver.patients

def test_register_invalid_payload(client: TestClient):
    """
    Test that missing required fields in the payload 
    results in a 422 Unprocessable Entity error.
    """
    # Missing caregivers field completely
    payload = {
        "patient_name": "Invalid Patient"
    }
    
    response = client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
    assert response.status_code == 422

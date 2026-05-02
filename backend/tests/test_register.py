import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.db.models.patient import Patient
from app.db.models.group import Group
from app.api.users.models import User
from app.core.config.settings import settings


def test_register_success(client: TestClient, db: Session):
    """
    Test successful registration with a valid payload.
    The register endpoint creates Group + Patient + Caregiver atomically.
    Schema: { patient_name, email, password, group_name? }
    Response: { patient_id, device_token, caregiver_jwt }
    """
    payload = {
        "patient_name": "Test Patient",
        "email": "caregiver_reg_success@test.com",
        "password": "securepassword123"
    }

    response = client.post(f"{settings.API_V1_STR}/auth/register", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "patient_id" in data
    assert "device_token" in data
    assert "caregiver_jwt" in data
    assert isinstance(data["patient_id"], int)
    assert isinstance(data["device_token"], str)


def test_register_db_validation(client: TestClient, db: Session):
    """
    Verify the registration correctly persists Group, Patient, and User
    rows to the database using the Group-based architecture.
    """
    payload = {
        "patient_name": "John Doe",
        "email": "caregiver_db_test@test.com",
        "password": "testpassword"
    }

    response = client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    patient_id = data["patient_id"]

    # Patient created
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    assert patient is not None
    assert patient.name == "John Doe"

    # Patient belongs to a group
    assert patient.group_id is not None
    group = db.query(Group).filter(Group.id == patient.group_id).first()
    assert group is not None

    # Caregiver created and in the same group
    caregiver = db.query(User).filter(User.email == "caregiver_db_test@test.com").first()
    assert caregiver is not None
    assert caregiver.is_caregiver is True
    assert caregiver.group_id == patient.group_id


def test_register_invalid_payload(client: TestClient):
    """
    Missing required fields must result in 422 Unprocessable Entity.
    """
    # Missing email and password
    payload = {"patient_name": "Invalid Patient"}
    response = client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
    assert response.status_code == 422

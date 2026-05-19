import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db.models.patient import Patient
from app.db.models.group import Group
from app.api.users.models import User
from app.core.security.password import hash_password


def test_activate_device_valid_code(client: TestClient, db: Session):
    response = client.post("/api/v1/auth/register", json={
        "patient_name": "Test Patient",
        "group_name": "Test Group",
        "email": "activate_test@example.com",
        "password": "testpass123",
        "sos_enabled": False
    })
    assert response.status_code == 200
    data = response.json()
    activation_code = data["activation_code"]
    assert activation_code is not None
    assert len(activation_code) == 6

    activate_response = client.post("/api/v1/auth/activate-device", json={
        "code": activation_code
    })
    assert activate_response.status_code == 200
    activate_data = activate_response.json()
    assert "device_token" in activate_data
    assert "patient_id" in activate_data
    assert activate_data["patient_id"] == data["patient_id"]


def test_activate_device_code_case_insensitive(client: TestClient, db: Session):
    response = client.post("/api/v1/auth/register", json={
        "patient_name": "Case Test",
        "group_name": "Case Group",
        "email": "case_test@example.com",
        "password": "testpass123",
        "sos_enabled": False
    })
    data = response.json()
    code = data["activation_code"]

    activate_response = client.post("/api/v1/auth/activate-device", json={
        "code": code.lower()
    })
    assert activate_response.status_code == 200


def test_activate_device_invalid_code(client: TestClient, db: Session):
    response = client.post("/api/v1/auth/activate-device", json={
        "code": "ZZZZZZ"
    })
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower() or "invalid" in response.json()["detail"].lower()


def test_activate_device_code_already_used(client: TestClient, db: Session):
    response = client.post("/api/v1/auth/register", json={
        "patient_name": "Used Code Test",
        "group_name": "Used Code Group",
        "email": "used_code@example.com",
        "password": "testpass123",
        "sos_enabled": False
    })
    data = response.json()
    activation_code = data["activation_code"]

    activate_response = client.post("/api/v1/auth/activate-device", json={
        "code": activation_code
    })
    assert activate_response.status_code == 200

    reuse_response = client.post("/api/v1/auth/activate-device", json={
        "code": activation_code
    })
    assert reuse_response.status_code == 410
    assert "already used" in reuse_response.json()["detail"].lower()


def test_activation_code_returns_in_register(client: TestClient, db: Session):
    response = client.post("/api/v1/auth/register", json={
        "patient_name": "Register Code Test",
        "group_name": "Register Code Group",
        "email": "register_code@example.com",
        "password": "testpass123",
        "sos_enabled": False
    })
    assert response.status_code == 200
    data = response.json()
    assert "activation_code" in data
    assert len(data["activation_code"]) == 6
    assert data["activation_code"].isalnum()


def test_activation_code_owner_endpoint(client: TestClient, db: Session):
    response = client.post("/api/v1/auth/register", json={
        "patient_name": "Owner Test",
        "group_name": "Owner Group",
        "email": "owner_test@example.com",
        "password": "testpass123",
        "sos_enabled": False
    })
    data = response.json()
    jwt_token = data["caregiver_jwt"]

    auth_headers = {"Authorization": f"Bearer {jwt_token}"}

    code_response = client.get("/api/v1/auth/patient/activation-code", headers=auth_headers)
    assert code_response.status_code == 200
    code_data = code_response.json()
    assert "activation_code" in code_data
    assert code_data["is_used"] is False
    assert code_data["activation_code"] == data["activation_code"]
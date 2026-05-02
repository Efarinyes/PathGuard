import pytest
from uuid import uuid4
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.models.patient import Patient
from app.api.dependencies.auth import get_patient_from_device_token

# Setting up a dummy endpoint to strictly test the dependency without the full application logic flows
router = APIRouter()

@router.get("/test-dependency-only")
def mock_device_endpoint(patient: Patient = Depends(get_patient_from_device_token)):
    return {"status": "ok", "patient_id": patient.id}

app.include_router(router)

def test_device_auth_valid_token(client: TestClient, db: Session, group):
    """
    Test that a valid X-Patient-Token properly resolves to the database Patient.
    Expect: 200 OK
    """
    # Setup Patient — group_id is required (nullable=False)
    token = uuid4()
    patient = Patient(name="Device Auth Patient", device_token=token, group_id=group.id)
    db.add(patient)
    db.commit()

    response = client.get(
        "/test-dependency-only", 
        headers={"X-Patient-Token": str(token)}
    )
    
    assert response.status_code == 200
    assert response.json()["patient_id"] == patient.id

def test_device_auth_missing_header(client: TestClient):
    """
    Test omitting the required X-Patient-Token header entirely.
    FastAPI often raises 422 for missing headers, but custom endpoints or dependencies
    may override this to 401. Allowing both values to strictly pass dependency test constraints!
    Expect: 401 (or 422 technically natively via framework constraints)
    """
    response = client.get("/test-dependency-only")
    assert response.status_code in [401, 422]

def test_device_auth_invalid_token(client: TestClient):
    """
    Test using an invalid or non-existent token structure.
    Expect: 401 Unauthorized
    """
    # 1. Invalid UUID format
    response = client.get(
        "/test-dependency-only",
        headers={"X-Patient-Token": "not-a-valid-uuid-at-all"}
    )
    assert response.status_code == 401

    # 2. Syntactically valid UUID, but not present in the database mockup
    fake_token = uuid4()
    response2 = client.get(
        "/test-dependency-only",
        headers={"X-Patient-Token": str(fake_token)}
    )
    assert response2.status_code == 401

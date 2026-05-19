import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.patient import Patient
from app.db.models.group import Group
from app.api.users.models import User
from app.db.models.walk import Walk


def test_start_walk_patient_auth(client: TestClient, db: Session, group: Group):
    """Patient can start a walk using their device token."""
    token = str(uuid4())
    patient = Patient(name="Walk Patient", device_token=token, group_id=group.id)
    db.add(patient)
    db.commit()

    db.query(Walk).filter(Walk.patient_id == patient.id).delete()
    db.commit()

    response = client.post(
        "/api/v1/walks/start",
        headers={"X-Patient-Token": str(token)}
    )

    assert response.status_code == 200
    walk_id = response.json()

    walk = db.query(Walk).filter(Walk.id == walk_id).first()
    assert walk is not None
    assert walk.initiated_by_type == "patient"
    assert walk.active is True


def test_start_walk_caregiver_auth(
    client: TestClient, db: Session, caregiver_user: User, auth_headers: dict
):
    """Caregiver JWT can start a walk when a patient exists in their group."""
    # Ensure the caregiver's group has exactly one patient
    existing_patient = db.query(Patient).filter(
        Patient.group_id == caregiver_user.group_id
    ).first()
    if not existing_patient:
        existing_patient = Patient(
            name="Caregiver's Patient",
            device_token=str(uuid4()),
            group_id=caregiver_user.group_id
        )
        db.add(existing_patient)
        db.commit()

    # Clear walks for this patient only
    db.query(Walk).filter(Walk.patient_id == existing_patient.id).delete()
    db.commit()

    response = client.post("/api/v1/walks/start", headers=auth_headers)

    assert response.status_code == 200
    walk_id = response.json()

    walk = db.query(Walk).filter(Walk.id == walk_id).first()
    assert walk is not None
    assert walk.initiated_by_type == "caregiver"
    assert walk.active is True


def test_start_walk_no_auth(client: TestClient):
    """No credentials → 401 or 403."""
    response = client.post("/api/v1/walks/start")
    assert response.status_code in [401, 403]

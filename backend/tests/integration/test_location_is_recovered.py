import pytest
from datetime import datetime
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.patient import Patient
from app.db.models.group import Group
from app.db.models.walk import Walk
from app.db.models.location import Location


def _create_patient_and_walk(db: Session, group: Group) -> tuple[Patient, Walk]:
    """Helper: create a patient in the group and an active walk for them."""
    patient = Patient(name="Recovered Loc Patient", device_token=uuid4(), group_id=group.id)
    db.add(patient)
    db.commit()
    db.refresh(patient)

    walk = Walk(
        start_time=datetime.utcnow(),
        active=True,
        initiated_by_type="patient",
        patient_id=patient.id
    )
    db.add(walk)
    db.commit()
    db.refresh(walk)
    return patient, walk


def test_location_model_is_recovered_default_false(db: Session, group: Group):
    """Location should have is_recovered default to False."""
    patient, walk = _create_patient_and_walk(db, group)

    location = Location(
        walk_id=walk.id,
        latitude=41.3851,
        longitude=2.1734,
        timestamp=datetime.utcnow(),
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    assert location.is_recovered is False


def test_location_model_is_recovered_can_be_set_true(db: Session, group: Group):
    """Location is_recovered can be set to True for offline-synced points."""
    patient, walk = _create_patient_and_walk(db, group)

    location = Location(
        walk_id=walk.id,
        latitude=41.3851,
        longitude=2.1734,
        timestamp=datetime.utcnow(),
        is_recovered=True
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    assert location.is_recovered is True


def test_location_api_accepts_is_recovered_true(
    client: TestClient, db: Session, group: Group
):
    """POST /locations/ with is_recovered=True should accept and store the value."""
    patient, walk = _create_patient_and_walk(db, group)

    payload = {
        "latitude": 41.3851,
        "longitude": 2.1734,
        "timestamp": datetime.utcnow().isoformat(),
        "walk_id": walk.id,
        "is_recovered": True
    }

    response = client.post(
        "/api/v1/locations/",
        json=payload,
        headers={"X-Patient-Token": str(patient.device_token)}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_recovered"] is True


def test_location_api_defaults_is_recovered_to_false(
    client: TestClient, db: Session, group: Group
):
    """POST /locations/ without is_recovered should default to False."""
    patient, walk = _create_patient_and_walk(db, group)

    payload = {
        "latitude": 41.3851,
        "longitude": 2.1734,
        "timestamp": datetime.utcnow().isoformat(),
        "walk_id": walk.id
    }

    response = client.post(
        "/api/v1/locations/",
        json=payload,
        headers={"X-Patient-Token": str(patient.device_token)}
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("is_recovered") is False


def test_location_batch_api_accepts_is_recovered(
    client: TestClient, db: Session, group: Group
):
    """POST /locations/batch with is_recovered=True should store the value."""
    patient, walk = _create_patient_and_walk(db, group)

    payload = {
        "walk_id": walk.id,
        "batch_id": str(uuid4()),
        "points": [
            {
                "latitude": 41.3851,
                "longitude": 2.1734,
                "timestamp": datetime.utcnow().isoformat(),
                "walk_id": walk.id,
                "is_recovered": True
            },
            {
                "latitude": 41.3852,
                "longitude": 2.1735,
                "timestamp": datetime.utcnow().isoformat(),
                "walk_id": walk.id,
                "is_recovered": True
            }
        ]
    }

    response = client.post(
        "/api/v1/locations/batch",
        json=payload,
        headers={"X-Patient-Token": str(patient.device_token)}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["inserted"] == 2

    locations = db.query(Location).filter(Location.walk_id == walk.id).all()
    assert len(locations) == 2
    assert all(loc.is_recovered for loc in locations)


def test_location_idempotent_response_includes_is_recovered(
    client: TestClient, db: Session, group: Group
):
    """Idempotent response should include is_recovered field."""
    patient, walk = _create_patient_and_walk(db, group)

    client_id = str(uuid4())

    payload = {
        "latitude": 41.3851,
        "longitude": 2.1734,
        "timestamp": datetime.utcnow().isoformat(),
        "walk_id": walk.id,
        "client_id": client_id,
        "is_recovered": True
    }

    response1 = client.post(
        "/api/v1/locations/",
        json=payload,
        headers={"X-Patient-Token": str(patient.device_token)}
    )
    assert response1.status_code == 200

    response2 = client.post(
        "/api/v1/locations/",
        json=payload,
        headers={"X-Patient-Token": str(patient.device_token)}
    )
    assert response2.status_code == 200
    data = response2.json()

    assert data["status"] == "already_synced"
    assert data["is_recovered"] is True
import pytest
from datetime import datetime
from uuid import uuid4
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
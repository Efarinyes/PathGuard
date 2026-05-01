import pytest
from sqlalchemy.orm import Session
from app.db.models.group import Group
from app.db.models.patient import Patient
from app.api.users.models import User
from app.core.security.password import hash_password

def test_group_relationships_integrity(db: Session):
    # 1. Create a Group
    group = Group(name="Garcia Family")
    db.add(group)
    db.commit()
    db.refresh(group)
    
    # 2. Create a Patient linked to that Group
    patient = Patient(
        name="Joan Garcia",
        group_id=group.id
    )
    db.add(patient)
    
    # 3. Create 2 User instances (caregivers) linked to the same Group
    caregiver1 = User(
        email="caregiver1@example.com",
        hashed_password=hash_password("password123"),
        full_name="Caregiver One",
        group_id=group.id,
        is_caregiver=True
    )
    caregiver2 = User(
        email="caregiver2@example.com",
        hashed_password=hash_password("password456"),
        full_name="Caregiver Two",
        group_id=group.id,
        is_caregiver=True
    )
    db.add(caregiver1)
    db.add(caregiver2)
    
    # 4. Persist everything in DB
    db.commit()
    
    # Refresh to ensure we have the latest state from DB
    db.refresh(group)
    db.refresh(patient)
    db.refresh(caregiver1)
    db.refresh(caregiver2)
    
    # 5. Query Group and verify
    queried_group = db.query(Group).filter(Group.id == group.id).first()
    assert queried_group is not None
    assert queried_group.name == "Garcia Family"
    
    # group.patient is not None
    assert queried_group.patient is not None
    assert queried_group.patient.id == patient.id
    assert queried_group.patient.name == "Joan Garcia"
    
    # len(group.caregivers) == 2
    assert len(queried_group.caregivers) == 2
    caregiver_emails = [c.email for c in queried_group.caregivers]
    assert "caregiver1@example.com" in caregiver_emails
    assert "caregiver2@example.com" in caregiver_emails
    
    # 6. Verify reverse relationships
    # patient.group is the same group
    assert patient.group is not None
    assert patient.group.id == queried_group.id
    
    # each caregiver.group is the same group
    assert caregiver1.group is not None
    assert caregiver1.group.id == queried_group.id
    assert caregiver2.group is not None
    assert caregiver2.group.id == queried_group.id

    # 7. Ensure no integrity or FK errors occur (already implicitly tested by commit)
    # But let's verify FK constraints by trying to query via FK
    db_patient = db.query(Patient).filter(Patient.group_id == queried_group.id).first()
    assert db_patient.id == patient.id
    
    db_caregivers = db.query(User).filter(User.group_id == queried_group.id).all()
    assert len(db_caregivers) == 2

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.api.users.models import User
from app.db.models.group import Group
from app.core.security.password import hash_password


def test_generate_invitation_as_owner(client: TestClient, db: Session) -> None:
    """
    Test that the group owner can generate an invitation code.
    """
    group = Group(name="Test Family")
    db.add(group)
    db.flush()

    owner = User(
        email="owner@test.com",
        hashed_password=hash_password("password123"),
        is_active=True,
        is_caregiver=True,
        is_owner=True,
        group_id=group.id
    )
    db.add(owner)
    db.commit()

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "owner@test.com", "password": "password123"}
    )
    token = response.json()["access_token"]

    invitation_data = {"email": "newcaregiver@test.com"}
    response = client.post(
        "/api/v1/auth/generate-invitation",
        json=invitation_data,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    content = response.json()
    assert "code" in content
    assert len(content["code"]) == 6
    assert "expires_in" in content
    assert content["email"] == "newcaregiver@test.com"


def test_generate_invitation_as_non_owner(client: TestClient, db: Session) -> None:
    """
    Test that a non-owner cannot generate invitation codes.
    """
    group = Group(name="Test Family 2")
    db.add(group)
    db.flush()

    caregiver = User(
        email="caregiver@test.com",
        hashed_password=hash_password("password123"),
        is_active=True,
        is_caregiver=True,
        is_owner=False,
        group_id=group.id
    )
    db.add(caregiver)
    db.commit()

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "caregiver@test.com", "password": "password123"}
    )
    token = response.json()["access_token"]

    invitation_data = {"email": "another@test.com"}
    response = client.post(
        "/api/v1/auth/generate-invitation",
        json=invitation_data,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403
    assert "owner" in response.json()["detail"]


def test_generate_invitation_existing_email(client: TestClient, db: Session) -> None:
    """
    Test that generating an invitation for an existing user fails.
    """
    group = Group(name="Test Family 3")
    db.add(group)
    db.flush()

    owner = User(
        email="owner3@test.com",
        hashed_password=hash_password("password123"),
        is_active=True,
        is_caregiver=True,
        is_owner=True,
        group_id=group.id
    )
    db.add(owner)

    existing_user = User(
        email="existing@test.com",
        hashed_password=hash_password("password123"),
        is_active=True,
        is_caregiver=True,
        is_owner=False,
        group_id=group.id
    )
    db.add(existing_user)
    db.commit()

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "owner3@test.com", "password": "password123"}
    )
    token = response.json()["access_token"]

    invitation_data = {"email": "existing@test.com"}
    response = client.post(
        "/api/v1/auth/generate-invitation",
        json=invitation_data,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]
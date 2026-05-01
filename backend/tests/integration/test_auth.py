from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.api.users.models import User
from app.db.models.group import Group
from app.core.security.password import hash_password

def test_register_atomic_success(client: TestClient, db: Session) -> None:
    """
    Test the atomic registration flow (Group + Patient + Caregiver).
    """
    register_data = {
        "patient_name": "Joan Garcia",
        "email": "caregiver@example.com",
        "password": "password123"
    }
    
    response = client.post("/api/v1/auth/register", json=register_data)
    
    assert response.status_code == 200
    content = response.json()
    
    # Verify response structure
    assert "device_token" in content
    assert "patient_id" in content
    assert "caregiver_id" in content
    assert "group_id" in content
    
    # Verify DB persistence
    group = db.query(Group).filter(Group.id == content["group_id"]).first()
    assert group is not None
    assert group.name == "Família Joan Garcia"
    
    user = db.query(User).filter(User.id == content["caregiver_id"]).first()
    assert user is not None
    assert user.email == "caregiver@example.com"
    assert user.group_id == group.id
    
    # Verify double registration fails
    response_dup = client.post("/api/v1/auth/register", json=register_data)
    assert response_dup.status_code == 400
    assert "already exists" in response_dup.json()["detail"]

def test_login_success(client: TestClient, db: Session) -> None:
    """
    Test that a valid user can login and receive a JWT.
    """
    # Create a group first
    group = Group(name="Test Family")
    db.add(group)
    db.flush()

    # Create a test user linked to the group
    email = "test@example.com"
    password = "password123"
    hashed_password = hash_password(password)
    user = User(
        email=email, 
        hashed_password=hashed_password, 
        is_active=True, 
        is_caregiver=True,
        group_id=group.id
    )
    db.add(user)
    db.commit()

    # Attempt login
    login_data = {
        "username": email,
        "password": password,
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    
    assert response.status_code == 200
    content = response.json()
    assert "access_token" in content
    assert content["token_type"] == "bearer"

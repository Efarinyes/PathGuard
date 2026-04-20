from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.api.users.models import User
from app.core.security.password import hash_password

def test_login_success(client: TestClient, db: Session) -> None:
    """
    Test that a valid user can login and receive a JWT.
    """
    # Create a test user
    email = "test@example.com"
    password = "password123"
    hashed_password = hash_password(password)
    user = User(email=email, hashed_password=hashed_password, is_active=True, is_caregiver=True)
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

def test_login_failure_wrong_password(client: TestClient, db: Session) -> None:
    """
    Test that login fails with an incorrect password.
    """
    # Create a test user
    email = "fail@example.com"
    password = "correct_password"
    hashed_password = hash_password(password)
    user = User(email=email, hashed_password=hashed_password, is_active=True, is_caregiver=True)
    db.add(user)
    db.commit()

    # Attempt login with wrong password
    login_data = {
        "username": email,
        "password": "wrong_password",
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email or password"

def test_login_failure_non_existent_user(client: TestClient) -> None:
    """
    Test that login fails for a user that doesn't exist.
    """
    login_data = {
        "username": "nobody@example.com",
        "password": "anypassword",
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email or password"

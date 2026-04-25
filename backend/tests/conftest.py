import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api import deps
from app.db.session import database as db_session
from app.api.users.models import User
from app.db.base.base_class import Base
from app.db.models.walk import Walk
from app.db.models.location import Location
from app.db.models.patient import Patient
from app.db.models.group import Group
from app.core.security.auth import create_access_token
from app.core.security.password import hash_password

# In-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    _engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Explicitly import all models to ensure they are on the Base.metadata
    Base.metadata.create_all(bind=_engine)
    return _engine

@pytest.fixture
def db(engine) -> Generator:
    """
    Provide a transactional database session for each test.
    """
    connection = engine.connect()
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = TestingSessionLocal()
    
    # Check if tables exist in this specific connection
    from sqlalchemy import inspect
    tables = inspect(connection).get_table_names()
    if "user" not in tables:
        # Emergency re-creation if SQLite memory lost the state
        Base.metadata.create_all(bind=connection)
        
    yield session
    
    session.close()
    connection.close()

@pytest.fixture
def client(db) -> Generator:
    """
    Provide a TestClient that uses the test database session.
    """
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    # Override the get_db dependency in all locations it might be imported from
    app.dependency_overrides[deps.get_db] = override_get_db
    app.dependency_overrides[db_session.get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def caregiver_user(db: Session) -> User:
    """
    Produce a test caregiver user.
    """
    # Use existing user if already created in this test session
    existing = db.query(User).filter(User.email == "caregiver@example.com").first()
    if existing:
        return existing
        
    user = User(
        email="caregiver@example.com",
        hashed_password=hash_password("password"),
        is_caregiver=True,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def auth_headers(caregiver_user: User) -> dict:
    """
    Provide authorization headers for a caregiver.
    """
    token = create_access_token(caregiver_user.id)
    return {"Authorization": f"Bearer {token}"}

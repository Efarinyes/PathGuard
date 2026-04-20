from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Generator

# SQLite for development
SQLALCHEMY_DATABASE_URL = "sqlite:///./pathguard.db"

# connect_args={"check_same_thread": False} is required only for SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator:
    """
    Dependency function to yield a database session.
    Ensures the session is closed after the request is completed.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

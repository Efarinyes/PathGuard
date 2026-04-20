from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "PathGuard"
    API_V1_STR: str = "/api/v1"
    
    # Security
    # In production, change this to a secure random string
    SECRET_KEY: str = os.getenv("SECRET_KEY", "b37a6b83f8b34c9c8e9b6a2d5f1e4a7c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    # Defaulting to a local PostgreSQL instance. 
    # Change via environment variable: DATABASE_URL=postgresql://user:pass@localhost/db
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/pathguard")

    class Config:
        case_sensitive = True

settings = Settings()

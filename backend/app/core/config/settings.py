from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "PathGuard"
    API_V1_STR: str = "/api/v1"
    
    # Security - MUST be set via environment variable in production
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    # Defaulting to a local PostgreSQL instance. 
    # Change via environment variable: DATABASE_URL=postgresql://user:pass@localhost/db
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/pathguard")

    class Config:
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SECRET_KEY:
            raise ValueError(
                "SECRET_KEY environment variable is required. "
                "Set it with: export SECRET_KEY='your-secure-random-string'"
            )

settings = Settings()

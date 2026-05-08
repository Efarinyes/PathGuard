from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "PathGuard"
    API_V1_STR: str = "/api/v1"
    
    # Security - MUST be set via environment variable in production
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    # Development: sqlite:///./pathguard.db (default, no server needed)
    # Production: postgresql://user:pass@host:5432/db
    # Override via environment variable: DATABASE_URL=...
    DATABASE_URL: str = "sqlite:///./pathguard.db"

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SECRET_KEY:
            raise ValueError(
                "SECRET_KEY environment variable is required. "
                "Set it in .env file or export SECRET_KEY='your-secure-random-string'"
            )

settings = Settings()

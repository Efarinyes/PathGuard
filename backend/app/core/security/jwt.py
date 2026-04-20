from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt, JWTError
from app.core.config.settings import settings

def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Creates a JWT access token with an expiration time.
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt

def verify_token(token: str) -> Optional[str]:
    """
    Verifies a JWT token and returns the subject (sub) if valid.
    Returns None if the token is invalid or expired.
    """
    try:
        decoded_token = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return decoded_token.get("sub")
    except (JWTError, Exception):
        return None

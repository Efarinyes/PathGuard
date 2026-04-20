from passlib.context import CryptContext

# Set up the context for password hashing using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Generates a secure hash of the provided plain-text password.
    """
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies that a plain-text password matches the provided hash.
    """
    return pwd_context.verify(plain_password, hashed_password)

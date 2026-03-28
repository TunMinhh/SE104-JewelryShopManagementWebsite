from datetime import datetime, timedelta, timezone
import hashlib
import os

from jose import JWTError, jwt

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8


def _sha256_digest(plain_password: str) -> str:
    return hashlib.sha256(plain_password.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, stored_password_hash: str) -> bool:
    if not stored_password_hash:
        return False

    if stored_password_hash.startswith("sha256$"):
        return stored_password_hash == f"sha256${_sha256_digest(plain_password)}"

    # Fallback for legacy/demo data where password is stored directly.
    return plain_password == stored_password_hash


def hash_password(plain_password: str) -> str:
    return f"sha256${_sha256_digest(plain_password)}"


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

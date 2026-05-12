from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta


PASSWORD_ITERATIONS = 210_000
TOKEN_EXPIRES_DAYS = 30


def create_password_salt() -> str:
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PASSWORD_ITERATIONS,
    )
    return password_hash.hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), expected_hash)


def create_access_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_token_expiration() -> datetime:
    return datetime.now(UTC) + timedelta(days=TOKEN_EXPIRES_DAYS)

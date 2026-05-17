from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_token_expiration,
    hash_token,
    verify_password,
)
from app.models.auth.auth_token import AuthToken
from app.models.auth.user_account import UserAccount


router = APIRouter(prefix="/auth", tags=["auth"])
DbSession = Annotated[Session, Depends(get_db)]
AuthorizationHeader = Annotated[str | None, Header(alias="Authorization")]


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"]


class CurrentUserResponse(BaseModel):
    id: int
    email: str
    status: str


class AuthenticatedSession:
    def __init__(self, user: UserAccount, auth_token: AuthToken) -> None:
        self.user = user
        self.auth_token = auth_token


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
    )


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise unauthorized()

    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token:
        raise unauthorized()

    return token


def get_authenticated_session(
    authorization: AuthorizationHeader,
    db: DbSession,
) -> AuthenticatedSession:
    token = extract_bearer_token(authorization)
    auth_token = db.query(AuthToken).filter(AuthToken.token_hash == hash_token(token)).first()
    now = datetime.now(UTC)

    if auth_token is not None and auth_token.expires_at.tzinfo is None:
        expires_at = auth_token.expires_at.replace(tzinfo=UTC)
    elif auth_token is not None:
        expires_at = auth_token.expires_at
    else:
        expires_at = None

    user_account: UserAccount | None = auth_token.user_account if auth_token else None

    if (
        auth_token is None
        or auth_token.revoked_at is not None
        or expires_at is None
        or expires_at <= now
        or user_account is None
        or user_account.status != "active"
    ):
        raise unauthorized()

    return AuthenticatedSession(user=user_account, auth_token=auth_token)


@router.post("/login")
def login(payload: LoginRequest, db: DbSession) -> LoginResponse:
    normalized_email = payload.email.strip().lower()

    if "@" not in normalized_email or not payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user = db.query(UserAccount).filter(UserAccount.email == normalized_email).first()

    if (
        user is None
        or user.status != "active"
        or not verify_password(payload.password, user.password_salt, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token()
    auth_token = AuthToken(
        user_account_id=user.id,
        token_hash=hash_token(token),
        expires_at=get_token_expiration(),
    )
    user.last_login_at = datetime.now(UTC)
    db.add(auth_token)
    db.commit()

    return LoginResponse(access_token=token, token_type="bearer")


@router.get("/me")
def get_current_user(
    session: Annotated[AuthenticatedSession, Depends(get_authenticated_session)],
) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=session.user.id,
        email=session.user.email,
        status=session.user.status,
    )


@router.post("/logout")
def logout(
    session: Annotated[AuthenticatedSession, Depends(get_authenticated_session)],
    db: DbSession,
) -> dict[str, str]:
    session.auth_token.revoked_at = datetime.now(UTC)
    db.commit()

    return {"status": "ok"}

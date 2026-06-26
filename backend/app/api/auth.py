"""Authentication API routes: register, login, me."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_middleware import get_current_user
from app.config import settings
from app.db.database import async_session_factory
from app.db.models import User

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthRequest(BaseModel):
    username: str
    password: str


def _create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@router.post("/register")
async def register(body: AuthRequest):
    """Register a new user. Returns JWT token."""
    if len(body.username) < 2 or len(body.username) > 64:
        raise HTTPException(status_code=400, detail="Username must be 2-64 characters")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.username == body.username))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already exists")

        user = User(
            username=body.username,
            hashed_password=pwd_context.hash(body.password),
            display_name=body.username,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = _create_token(user.id)
    return {
        "token": token,
        "user": {"id": user.id, "username": user.username, "display_name": user.display_name},
    }


@router.post("/login")
async def login(body: AuthRequest):
    """Login with username and password. Returns JWT token."""
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.username == body.username))
        user = result.scalar_one_or_none()

        if not user or not pwd_context.verify(body.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid username or password")

    token = _create_token(user.id)
    return {
        "token": token,
        "user": {"id": user.id, "username": user.username, "display_name": user.display_name},
    }


@router.get("/me")
async def get_me(user_id: int = Depends(get_current_user)):
    """Return current user info."""
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": user.id, "username": user.username, "display_name": user.display_name}

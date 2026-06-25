"""API router — mounts all REST endpoints."""
from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.sessions import router as sessions_router
from app.api.files import router as files_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
api_router.include_router(files_router, prefix="/files", tags=["files"])

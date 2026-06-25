"""Health check endpoint."""
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

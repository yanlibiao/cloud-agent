"""Session management endpoints — persists to DB."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_middleware import get_current_user
from app.db.database import async_session_factory
from app.db.models import DBSession, DBMessage
from app.sandbox.manager import sandbox_manager

from pydantic import BaseModel


class TitleUpdate(BaseModel):
    title: str


class CreateSessionResponse(BaseModel):
    id: str
    title: str
    status: str
    workspace_path: str
    created_at: str
    updated_at: str


class SessionListItem(BaseModel):
    id: str
    title: str
    status: str
    created_at: str
    updated_at: str


class MessageItem(BaseModel):
    id: str
    role: str
    content: str
    tool_calls: dict | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    created_at: str


class SessionDetail(BaseModel):
    id: str
    title: str
    status: str
    messages: list[MessageItem]
    created_at: str
    updated_at: str


class StatusResponse(BaseModel):
    status: str


router = APIRouter()


@router.post("")
async def create_session(user_id: int = Depends(get_current_user)):
    """Create a new agent session and its sandbox workspace."""
    now = datetime.now(timezone.utc)
    session_id = f"sess_{uuid.uuid4().hex[:12]}"

    # Create sandbox (sets up workspace directory and container)
    sandbox = await sandbox_manager.create_session(session_id)

    async with async_session_factory() as db:
        db_session = DBSession(
            id=session_id,
            user_id=user_id,
            title="New Session",
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(db_session)
        await db.commit()

    return {
        "id": session_id,
        "title": "New Session",
        "status": "active",
        "workspace_path": sandbox.workspace_path,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }


@router.get("")
async def list_sessions(user_id: int = Depends(get_current_user)):
    """List all sessions for the current user."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(DBSession)
            .where(DBSession.user_id == user_id)
            .order_by(DBSession.updated_at.desc())
        )
        sessions = result.scalars().all()
        return [
            {
                "id": s.id,
                "title": s.title,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else "",
                "updated_at": s.updated_at.isoformat() if s.updated_at else "",
            }
            for s in sessions
        ]


@router.get("/{session_id}")
async def get_session(session_id: str, user_id: int = Depends(get_current_user)):
    """Get session details with messages."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(DBSession).where(DBSession.id == session_id, DBSession.user_id == user_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Load messages
        msg_result = await db.execute(
            select(DBMessage)
            .where(DBMessage.session_id == session_id)
            .order_by(DBMessage.created_at)
        )
        messages = msg_result.scalars().all()

        return {
            "id": session.id,
            "title": session.title,
            "status": session.status,
            "messages": [
                {
                    "id": f"msg_{m.id}",
                    "role": m.role,
                    "content": m.content,
                    "tool_calls": m.tool_calls,
                    "tool_call_id": m.tool_call_id,
                    "tool_name": m.tool_name,
                    "created_at": m.created_at.isoformat() if m.created_at else "",
                }
                for m in messages
            ],
            "created_at": session.created_at.isoformat() if session.created_at else "",
            "updated_at": session.updated_at.isoformat() if session.updated_at else "",
        }


@router.put("/{session_id}/title")
async def update_session_title(
    session_id: str, body: TitleUpdate, user_id: int = Depends(get_current_user)
):
    """Rename a session."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(DBSession).where(DBSession.id == session_id, DBSession.user_id == user_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        session.title = body.title
        session.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"status": "ok"}


@router.delete("/{session_id}")
async def delete_session(session_id: str, user_id: int = Depends(get_current_user)):
    """Delete a session and its sandbox."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(DBSession).where(DBSession.id == session_id, DBSession.user_id == user_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        await db.delete(session)
        await db.commit()

    await sandbox_manager.destroy_session(session_id)
    return {"status": "deleted"}

"""Session management endpoints."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.agent.types import AgentSession, SessionStatus
from app.sandbox.manager import sandbox_manager

router = APIRouter()

# In-memory session store (MVP)
_sessions: dict[str, AgentSession] = {}


@router.post("")
async def create_session():
    """Create a new agent session and its sandbox workspace."""
    now = datetime.now(timezone.utc).isoformat()
    session_id = f"sess_{uuid.uuid4().hex[:12]}"

    # Create sandbox (sets up workspace directory and container)
    sandbox = await sandbox_manager.create_session(session_id)

    session = AgentSession(
        id=session_id,
        title="New Session",
        status=SessionStatus.ACTIVE,
        container_id=sandbox.container_id if hasattr(sandbox, 'container_id') and sandbox.container_id else None,
        workspace_path=sandbox.workspace_path,
        created_at=now,
        updated_at=now,
    )
    _sessions[session.id] = session
    return session.model_dump()


@router.get("")
async def list_sessions():
    """List all sessions."""
    return [
        s.model_dump()
        for s in sorted(
            _sessions.values(),
            key=lambda x: x.created_at,
            reverse=True,
        )
    ]


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Get session details."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update container/workspace info from sandbox manager
    sandbox = sandbox_manager.get_session(session_id)
    if sandbox:
        session.workspace_path = sandbox.workspace_path

    return session.model_dump()


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session."""
    session = _sessions.pop(session_id, None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await sandbox_manager.destroy_session(session_id)
    return {"status": "deleted"}

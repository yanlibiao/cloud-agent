"""WebSocket handler — bridges frontend ↔ agent loop with DB persistence."""
import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy import select

from app.agent.loop import AgentLoop
from app.agent.types import Message, MessageRole, ServerEvent, ToolCall
from app.config import settings
from app.db.database import async_session_factory
from app.db.models import DBSession, DBMessage
from app.llm.client import LLMClient
from app.sandbox.manager import sandbox_manager
from app.tools.registry import create_default_registry
from app.ws.protocol import ClientMessage

logger = logging.getLogger(__name__)
ws_router = APIRouter()

# Global (MVP: single LLM client and tools)
llm_client = LLMClient()
tool_registry = create_default_registry()

# Per-session agent loops so different sessions stay isolated
_session_loops: dict[str, AgentLoop] = {}
# Track how many messages were already saved per session
_session_saved_count: dict[str, int] = {}


async def _auto_name_session(session_id: str, user_message: str) -> None:
    """Generate a short title from the first user message and update the DB."""
    try:
        resp = await llm_client.generate([
            {
                "role": "system",
                "content": "Generate a very short title (max 6 words, in Chinese unless the user's message is in English) for a conversation that starts with the following message. Reply with ONLY the title, no quotes, no punctuation.",
            },
            {"role": "user", "content": user_message},
        ], max_tokens=30)
        title = resp.strip().strip('"').strip("'")[:100]
        if not title:
            return
        async with async_session_factory() as db:
            result = await db.execute(
                select(DBSession).where(DBSession.id == session_id)
            )
            sess = result.scalar_one_or_none()
            if sess and sess.title == "New Session":
                sess.title = title
                await db.commit()
                logger.info(f"Auto-named session {session_id}: {title}")
    except Exception as e:
        logger.warning(f"Auto-name session failed for {session_id}: {e}")


async def _save_messages(session_id: str, messages: list[Message]) -> None:
    """Persist a batch of messages to the DB, skipping user messages (saved by frontend init)."""
    if not messages:
        return
    try:
        async with async_session_factory() as db:
            for msg in messages:
                role_str = msg.role.value if hasattr(msg.role, "value") else msg.role
                tool_calls_data = None
                if msg.tool_calls:
                    tool_calls_data = [
                        {
                            "id": tc.id,
                            "name": tc.name,
                            "args": tc.args,
                            "status": tc.status.value if hasattr(tc.status, "value") else tc.status,
                            "result": tc.result,
                            "error": tc.error,
                            "exit_code": tc.exit_code,
                        }
                        for tc in msg.tool_calls
                    ]

                db_msg = DBMessage(
                    session_id=session_id,
                    role=role_str,
                    content=msg.content or "",
                    tool_calls=tool_calls_data,
                    tool_call_id=msg.tool_call_id,
                    tool_name=msg.tool_name,
                )
                db.add(db_msg)

            # Update session timestamp
            result = await db.execute(select(DBSession).where(DBSession.id == session_id))
            sess = result.scalar_one_or_none()
            if sess:
                sess.updated_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)

            await db.commit()
    except Exception as e:
        logger.error(f"Failed to save messages to DB: {e}")


async def _load_history(session_id: str) -> list[Message]:
    """Load all previous messages from DB for this session."""
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(DBMessage)
                .where(DBMessage.session_id == session_id)
                .order_by(DBMessage.created_at)
            )
            db_msgs = result.scalars().all()

        messages = []
        for m in db_msgs:
            if m.role == "user":
                messages.append(Message(role=MessageRole.USER, content=m.content or ""))
            elif m.role == "assistant":
                tool_calls = None
                if m.tool_calls:
                    tool_calls = [
                        ToolCall(
                            id=tc.get("id", ""),
                            name=tc.get("name", ""),
                            args=tc.get("args", {}),
                            status="completed",
                            result=tc.get("result"),
                            error=tc.get("error"),
                            exit_code=tc.get("exit_code"),
                        )
                        for tc in m.tool_calls
                    ]
                messages.append(
                    Message(role=MessageRole.ASSISTANT, content=m.content or "", tool_calls=tool_calls)
                )
            elif m.role == "tool":
                messages.append(
                    Message(
                        role=MessageRole.TOOL,
                        content=m.content or "",
                        tool_call_id=m.tool_call_id or "",
                        tool_name=m.tool_name or "",
                    )
                )
        return messages
    except Exception as e:
        logger.error(f"Failed to load history: {e}")


@ws_router.websocket("/ws/{session_id}")
async def agent_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"WebSocket connected: session={session_id}")

    # Validate JWT token from query param
    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.send_json(
            ServerEvent(type="error", data={"message": "Authentication required"}).model_dump()
        )
        await websocket.close()
        return

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: int = int(payload.get("sub"))
        if user_id is None:
            raise ValueError("Invalid token payload")
    except (JWTError, ValueError):
        await websocket.send_json(
            ServerEvent(type="error", data={"message": "Invalid token"}).model_dump()
        )
        await websocket.close()
        return

    # Verify session belongs to user
    async with async_session_factory() as db:
        result = await db.execute(
            select(DBSession).where(DBSession.id == session_id, DBSession.user_id == user_id)
        )
        if not result.scalar_one_or_none():
            await websocket.send_json(
                ServerEvent(type="error", data={"message": "Session not found"}).model_dump()
            )
            await websocket.close()
            return

    # Get or create sandbox
    sandbox = sandbox_manager.get_session(session_id)
    if not sandbox:
        try:
            sandbox = await sandbox_manager.create_session(session_id)
            logger.info(f"Created sandbox for session {session_id}")
        except RuntimeError as e:
            await websocket.send_json(
                ServerEvent(type="error", data={"message": str(e)}).model_dump()
            )
            await websocket.close()
            return

    # Load conversation history from DB
    history = await _load_history(session_id)
    logger.info(f"Loaded {len(history)} history messages for session {session_id}")

    # Track already-saved message count to avoid re-saving on reconnect
    _session_saved_count[session_id] = len(history)

    # Reuse or create per-session agent loop with history
    if session_id in _session_loops:
        agent_loop = _session_loops[session_id]
        if history:
            agent_loop.messages = history
    else:
        agent_loop = AgentLoop(llm=llm_client, tools=tool_registry, history=history)
        _session_loops[session_id] = agent_loop

    # Send initial state
    await websocket.send_json(
        ServerEvent(
            type="session_state",
            data={
                "session_id": session_id,
                "workspace_path": sandbox.workspace_path,
                "status": "ready",
            },
        ).model_dump()
    )

    # Track the current run task
    current_run: asyncio.Task | None = None

    try:
        while True:
            raw = await websocket.receive_text()
            msg = ClientMessage.model_validate_json(raw)

            if msg.type == "user_prompt" and msg.text:
                # Track message count before this turn so we only save new ones
                count_before = len(agent_loop.messages)
                first_user_text = msg.text if count_before == 0 else None

                async def stream_turn():
                    try:
                        async for event in agent_loop.run_turn(msg.text, sandbox):
                            await websocket.send_json(event.model_dump())
                    except asyncio.CancelledError:
                        pass
                    except Exception as e:
                        logger.exception(f"Agent loop error: session={session_id}")
                        try:
                            await websocket.send_json(
                                ServerEvent(type="error", data={"message": f"Agent error: {str(e)}"}).model_dump()
                            )
                        except Exception:
                            pass
                    finally:
                        # Save only new messages added during this turn
                        new_msgs = agent_loop.messages[count_before:]
                        if new_msgs:
                            await _save_messages(session_id, new_msgs)
                            _session_saved_count[session_id] = len(agent_loop.messages)
                        # Auto-name if still has default title
                        if first_user_text:
                            asyncio.create_task(_auto_name_session(session_id, first_user_text))

                current_run = asyncio.create_task(stream_turn())

            elif msg.type == "interrupt":
                if current_run and not current_run.done():
                    logger.info(f"Interrupting agent: session={session_id}")
                    agent_loop.cancel()
                    await current_run
                    current_run = None
                    await websocket.send_json(
                        ServerEvent(type="turn_completed", data={"text": "[Stopped]"}).model_dump()
                    )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: session={session_id}")
        if current_run and not current_run.done():
            agent_loop.cancel()
    except Exception as e:
        logger.exception(f"WebSocket error: session={session_id}")
        try:
            await websocket.send_json(
                ServerEvent(type="error", data={"message": str(e)}).model_dump()
            )
        except Exception:
            pass

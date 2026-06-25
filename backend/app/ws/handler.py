"""WebSocket handler — bridges frontend ↔ agent loop."""
import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.agent.loop import AgentLoop
from app.agent.types import ServerEvent
from app.config import settings
from app.llm.client import LLMClient
from app.sandbox.manager import sandbox_manager
from app.tools.registry import create_default_registry
from app.ws.protocol import ClientMessage

logger = logging.getLogger(__name__)
ws_router = APIRouter()

# Global (MVP: single LLM client and tools)
llm_client = LLMClient()
tool_registry = create_default_registry()


@ws_router.websocket("/ws/{session_id}")
async def agent_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"WebSocket connected: session={session_id}")

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

    # Create agent loop
    agent_loop = AgentLoop(llm=llm_client, tools=tool_registry)

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
                # Start the agent loop in a background task so we can
                # still receive interrupt messages while it runs.
                async def stream_turn():
                    async for event in agent_loop.run_turn(msg.text, sandbox):
                        await websocket.send_json(event.model_dump())

                current_run = asyncio.create_task(stream_turn())

            elif msg.type == "interrupt":
                if current_run and not current_run.done():
                    logger.info(f"Interrupting agent: session={session_id}")
                    agent_loop.cancel()
                    await current_run
                    current_run = None
                    # Reset agent state to idle
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

import json
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class ToolCallStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"


class ToolCall(BaseModel):
    id: str = Field(default_factory=lambda: f"tc_{uuid4().hex[:12]}")
    name: str
    args: dict[str, Any]
    status: ToolCallStatus = ToolCallStatus.PENDING
    result: str | None = None
    error: str | None = None
    exit_code: int | None = None


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class Message(BaseModel):
    role: MessageRole
    content: str
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


class AgentSession(BaseModel):
    id: str = Field(default_factory=lambda: f"sess_{uuid4().hex[:12]}")
    title: str = "New Session"
    status: SessionStatus = SessionStatus.ACTIVE
    messages: list[Message] = []
    container_id: str | None = None
    workspace_path: str | None = None
    created_at: str = ""
    updated_at: str = ""


# ===== WebSocket Protocol =====

class ClientMessage(BaseModel):
    type: str  # user_prompt, interrupt, terminal_input
    text: str | None = None
    request_id: str | None = None
    action: str | None = None  # approve / deny


class ServerEvent(BaseModel):
    type: str  # agent_text_delta, tool_call_begin, tool_call_delta, tool_call_end, file_changed, turn_completed, error, approval_required, session_state
    data: Any = None

    def json_bytes(self) -> bytes:
        return (self.model_dump_json(exclude_none=True) + "\n").encode()

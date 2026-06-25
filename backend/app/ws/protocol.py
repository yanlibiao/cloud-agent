"""WebSocket protocol models."""
from pydantic import BaseModel


class ClientMessage(BaseModel):
    type: str  # user_prompt, interrupt
    text: str | None = None
    request_id: str | None = None
    action: str | None = None  # approve / deny (for future approval system)


class ServerEvent(BaseModel):
    type: str  # agent_text_delta, tool_call_begin, tool_call_delta, tool_call_end, file_changed, turn_completed, error, session_state
    data: dict | None = None

    def json_bytes(self) -> bytes:
        return (self.model_dump_json(exclude_none=True) + "\n").encode()

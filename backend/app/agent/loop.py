"""Core agent loop — the inner turn loop."""
import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from app.agent.context import TOOL_DEFINITIONS, build_messages
from app.agent.types import (
    Message,
    MessageRole,
    ServerEvent,
    ToolCall,
    ToolCallStatus,
)
from app.config import settings
from app.llm.client import LLMClient
from app.sandbox.manager import LocalSandboxSession, DockerSandboxSession
from app.tools.registry import ToolRegistry

SandboxSession = LocalSandboxSession


class AgentLoop:
    """Inner turn loop: model → tool_call → execute → feed_back → repeat."""

    def __init__(
        self,
        llm: LLMClient,
        tools: ToolRegistry,
        history: list[Message] | None = None,
    ):
        self.llm = llm
        self.tools = tools
        self.messages: list[Message] = history or []
        self._cancelled = False

    def cancel(self):
        """Signal the loop to stop at the next safe point."""
        self._cancelled = True

    async def run_turn(
        self,
        user_input: str,
        sandbox: SandboxSession,
    ) -> AsyncGenerator[ServerEvent, None]:
        """
        Execute one user turn. Yields streaming events.
        Returns the last assistant message.
        """
        # Build context
        history = self.messages.copy()
        llm_messages = build_messages(user_input, history)

        # Append user message to history
        user_msg = Message(role=MessageRole.USER, content=user_input)
        self.messages.append(user_msg)

        tool_iterations = 0
        last_assistant_text = ""
        last_assistant_tool_calls: list[ToolCall] = []

        while tool_iterations < settings.agent_max_tool_iterations:
            if self._cancelled:
                yield ServerEvent(type="turn_completed", data={"text": "\n[Stopped by user]"})
                self._cancelled = False
                break

            tool_iterations += 1
            collected_text = ""
            collected_tool_calls = []

            # Stream from LLM
            async for event in self.llm.stream(llm_messages, tools=TOOL_DEFINITIONS):
                if event["type"] == "text_delta":
                    collected_text += event["text"]
                    yield ServerEvent(type="agent_text_delta", data={"text": event["text"]})

                elif event["type"] == "tool_calls":
                    collected_tool_calls = event["calls"]
                    for tc in event["calls"]:
                        yield ServerEvent(
                            type="tool_call_begin",
                            data={
                                "tool_call_id": tc["id"],
                                "tool_name": tc["name"],
                                "args": tc["args"],
                            },
                        )

                elif event["type"] == "done":
                    break

            # If no tool calls, turn is complete
            if not collected_tool_calls:
                last_assistant_text = collected_text
                yield ServerEvent(type="turn_completed", data={"text": collected_text})

                # Save assistant message
                assistant_msg = Message(
                    role=MessageRole.ASSISTANT,
                    content=collected_text,
                )
                self.messages.append(assistant_msg)
                break

            # Build assistant message with tool calls
            tool_calls = []
            for tc in collected_tool_calls:
                tool_call = ToolCall(
                    id=tc["id"],
                    name=tc["name"],
                    args=tc["args"],
                    status=ToolCallStatus.RUNNING,
                )
                tool_calls.append(tool_call)

            assistant_msg = Message(
                role=MessageRole.ASSISTANT,
                content=collected_text,
                tool_calls=tool_calls,
            )
            self.messages.append(assistant_msg)

            # Add assistant message to LLM context ONCE (with ALL tool_calls)
            llm_messages.append({
                "role": "assistant",
                "content": collected_text or None,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["args"]),
                        },
                    }
                    for tc in collected_tool_calls
                ],
            })

            # Execute tool calls
            for tc_data in collected_tool_calls:
                tc_id = tc_data["id"]
                tc_name = tc_data["name"]
                tc_args = tc_data["args"]

                tool_result_text = await self.tools.execute(tc_name, tc_args, sandbox)

                # Truncate long results
                if len(tool_result_text) > settings.agent_max_output_length:
                    tool_result_text = (
                        tool_result_text[: settings.agent_max_output_length]
                        + f"\n...(truncated, total {len(tool_result_text)} chars)"
                    )

                # Update tool call in history
                for tc in tool_calls:
                    if tc.id == tc_id:
                        tc.status = ToolCallStatus.COMPLETED
                        tc.result = tool_result_text
                        break

                # Append tool result to history
                tool_msg = Message(
                    role=MessageRole.TOOL,
                    content=tool_result_text,
                    tool_call_id=tc_id,
                    tool_name=tc_name,
                )
                self.messages.append(tool_msg)

                # Add tool result to LLM context for next iteration
                llm_messages.append({
                    "role": "tool",
                    "tool_call_id": tc_id,
                    "content": tool_result_text[:10000],  # Keep LLM messages bounded
                })

                yield ServerEvent(
                    type="tool_call_end",
                    data={
                        "tool_call_id": tc_id,
                        "tool_name": tc_name,
                        "result": tool_result_text[:500],  # Preview for frontend
                    },
                )

                # Check for files created/modified
                if tc_name in ("write_file", "apply_patch"):
                    path = tc_args.get("path", tc_args.get("patch", ""))
                    yield ServerEvent(
                        type="file_changed",
                        data={
                            "path": path,
                            "operation": "modify",
                        },
                    )

            last_assistant_text = collected_text
            last_assistant_tool_calls = tool_calls

            # Clear collected for next iteration
            collected_text = ""
            collected_tool_calls = []

        if tool_iterations >= settings.agent_max_tool_iterations:
            yield ServerEvent(
                type="error",
                data={"message": "Agent exceeded maximum tool iterations"},
            )

"""
Minimal prompt context builder.
Assembles system prompt + tool definitions + conversation history + user input.
"""
import json

from app.agent.types import Message, MessageRole


SYSTEM_PROMPT = """You is an AI software engineer running inside a cloud Linux sandbox. You have access to a set of tools to help you complete tasks.

You work in a workspace at /workspace. All files you create should be placed there.

Rules:
1. Think step by step. Break down complex tasks.
2. Use the tools available to you to accomplish the task.
3. When you run commands, explain what you're doing.
4. After completing a task, summarize what was done.
5. If something fails, try to fix it or try a different approach.
6. Keep your responses concise and focused.

Time Budget:
- Before you start, estimate how long this task will take.
- If the task can be completed within ~12 minutes, do it directly.
- If it takes longer than ~12 minutes, do NOT try to finish it all at once. Instead, complete ONLY the first logical sub-task that takes ~2 minutes, then summarize what's done and list the remaining sub-tasks so the user can tell you what to do next.
- Each sub-task should be self-contained and deliver visible progress.
- Prioritize quick wins: write file skeletons, run one command, verify one thing — then hand off."""


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "exec_command",
            "description": "Execute a shell command in the sandbox. Returns stdout, stderr, and exit code. The working directory is /workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute"
                    },
                    "description": {
                        "type": "string",
                        "description": "Brief explanation of why this command is being run"
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default 30, max 60)",
                        "default": 30
                    }
                },
                "required": ["command", "description"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file at the specified path (relative to /workspace). Creates parent directories if needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File path relative to /workspace"
                    },
                    "content": {
                        "type": "string",
                        "description": "File content to write"
                    }
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file at the specified path (relative to /workspace).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File path relative to /workspace"
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List files and directories at the specified path (relative to /workspace).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Directory path relative to /workspace",
                        "default": "."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "grep_files",
            "description": "Search for a pattern in files under the specified path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Search pattern (regex)"
                    },
                    "path": {
                        "type": "string",
                        "description": "Path relative to /workspace to search in",
                        "default": "."
                    }
                },
                "required": ["pattern"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "apply_patch",
            "description": "Apply a unified diff patch to a file. The patch should be in standard unified diff format.",
            "parameters": {
                "type": "object",
                "properties": {
                    "patch": {
                        "type": "string",
                        "description": "The unified diff patch content"
                    }
                },
                "required": ["patch"]
            }
        }
    }
]


def build_messages(
    user_input: str,
    history: list[Message] | None = None,
) -> list[dict]:
    """Build the message list for the LLM API call."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    if history:
        for msg in history:
            if msg.role == MessageRole.USER:
                messages.append({"role": "user", "content": msg.content})
            elif msg.role == MessageRole.ASSISTANT:
                content = msg.content or ""
                if msg.tool_calls:
                    openai_tool_calls = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.name,
                                "arguments": json.dumps(tc.args),
                            },
                        }
                        for tc in msg.tool_calls
                    ]
                    messages.append({
                        "role": "assistant",
                        "content": content or None,
                        "tool_calls": openai_tool_calls,
                    })
                else:
                    messages.append({"role": "assistant", "content": content})
            elif msg.role == MessageRole.TOOL:
                messages.append({
                    "role": "tool",
                    "tool_call_id": msg.tool_call_id,
                    "content": msg.content,
                })

    messages.append({"role": "user", "content": user_input})
    return messages

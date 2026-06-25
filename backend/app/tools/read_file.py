"""Tool: read file contents from the sandbox workspace."""
import os
from typing import Any

from app.tools.base import BaseTool, ToolResult


class ReadFileTool(BaseTool):
    name = "read_file"
    description = "Read file contents from /workspace"

    async def run(self, sandbox, args: dict[str, Any]) -> ToolResult:
        path = args.get("path", "")
        if not path:
            return ToolResult(False, error="No path provided")

        # For local sandbox: read directly from filesystem
        full_path = os.path.join(sandbox.workspace_path, path)
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            return ToolResult(True, output=content)
        except FileNotFoundError:
            return ToolResult(False, error=f"File not found: {path}")
        except Exception as e:
            return ToolResult(False, error=str(e))

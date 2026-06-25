"""Tool: write content to a file in the sandbox workspace."""
import json
import os
from typing import Any

from app.tools.base import BaseTool, ToolResult


class WriteFileTool(BaseTool):
    name = "write_file"
    description = "Write content to a file in /workspace"

    async def run(self, sandbox, args: dict[str, Any]) -> ToolResult:
        path = args.get("path", "")
        content = args.get("content", "")

        if not path:
            return ToolResult(False, error="No path provided")

        # Sanitize: prevent path traversal
        safe_path = os.path.normpath(path).lstrip("/")
        if safe_path.startswith(".."):
            return ToolResult(False, error="Invalid path")

        # For local sandbox: write directly to filesystem (no shell encoding issues)
        full_path = os.path.join(sandbox.workspace_path, safe_path)
        parent = os.path.dirname(full_path)
        os.makedirs(parent, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)

        return ToolResult(True, output=f"Written {len(content)} bytes to {safe_path}")

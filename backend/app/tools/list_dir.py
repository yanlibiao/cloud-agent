"""Tool: list directory contents."""
import os
from typing import Any

from app.tools.base import BaseTool, ToolResult


class ListDirTool(BaseTool):
    name = "list_dir"
    description = "List files and directories"

    async def run(self, sandbox, args: dict[str, Any]) -> ToolResult:
        path = args.get("path", ".")

        full_path = os.path.join(sandbox.workspace_path, path)
        if not os.path.isdir(full_path):
            return ToolResult(False, error=f"Not a directory: {path}")

        try:
            entries = os.listdir(full_path)
            lines = []
            for name in sorted(entries):
                fp = os.path.join(full_path, name)
                try:
                    stat = os.stat(fp)
                    is_dir = os.path.isdir(fp)
                    size = stat.st_size
                    kind = "d" if is_dir else "-"
                    lines.append(f"{kind} {size:>8} {name}")
                except OSError:
                    lines.append(f"? {'?':>8} {name}")
            output = "\n".join(lines) if lines else "(empty directory)"
            return ToolResult(True, output=output)
        except Exception as e:
            return ToolResult(False, error=str(e))

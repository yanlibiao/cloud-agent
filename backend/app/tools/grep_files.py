"""Tool: grep/search files for a pattern."""
import os
from typing import Any

from app.tools.base import BaseTool, ToolResult


class GrepFilesTool(BaseTool):
    name = "grep_files"
    description = "Search files for a pattern"

    async def run(self, sandbox, args: dict[str, Any]) -> ToolResult:
        pattern = args.get("pattern", "")
        path = args.get("path", ".")

        if not pattern:
            return ToolResult(False, error="No pattern provided")

        search_root = os.path.join(sandbox.workspace_path, path)
        if not os.path.isdir(search_root):
            return ToolResult(False, error=f"Not a directory: {path}")

        try:
            matches = []
            for root, dirs, files in os.walk(search_root):
                # Skip hidden dirs
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                for fname in files:
                    if fname.startswith("."):
                        continue
                    fpath = os.path.join(root, fname)
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                            for i, line in enumerate(f, 1):
                                if pattern in line:
                                    rel = os.path.relpath(fpath, sandbox.workspace_path)
                                    matches.append(f"{rel}:{i}:{line.rstrip()}")
                    except (OSError, UnicodeDecodeError):
                        continue

            if matches:
                return ToolResult(True, output="\n".join(matches))
            else:
                return ToolResult(True, output="(no matches)")
        except Exception as e:
            return ToolResult(False, error=str(e))

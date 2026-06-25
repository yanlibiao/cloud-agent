"""Tool: apply a unified diff patch."""
import os
from typing import Any

from app.tools.base import BaseTool, ToolResult


class ApplyPatchTool(BaseTool):
    name = "apply_patch"
    description = "Apply a unified diff patch to files"
    requires_approval = True

    async def run(self, sandbox, args: dict[str, Any]) -> ToolResult:
        patch = args.get("patch", "")
        if not patch:
            return ToolResult(False, error="No patch provided")

        # Write patch file to workspace using direct I/O (avoid shell encoding issues)
        patch_path = os.path.join(sandbox.workspace_path, "_patch.diff")
        try:
            with open(patch_path, "w", encoding="utf-8") as f:
                f.write(patch)
        except Exception as e:
            return ToolResult(False, error=f"Failed to write patch file: {e}")

        # Apply patch via sandbox (uses cd wrapper for local mode, direct in Docker)
        result = await sandbox.exec_command(
            "patch -p0 < _patch.diff 2>&1 || patch -p1 < _patch.diff 2>&1"
        )

        # Clean up patch file
        try:
            os.remove(patch_path)
        except OSError:
            pass

        return ToolResult(
            result.exit_code == 0,
            output=result.stdout or "Patch applied",
            error=result.stderr if result.exit_code != 0 else "",
        )

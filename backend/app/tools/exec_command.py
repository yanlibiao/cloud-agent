"""Tool: execute shell commands in the sandbox."""
from typing import Any

from app.tools.base import BaseTool, ToolResult


class ExecCommandTool(BaseTool):
    name = "exec_command"
    description = "Execute a shell command in the sandbox"
    requires_approval = False

    async def run(self, sandbox, args: dict[str, Any]) -> ToolResult:
        command = args.get("command", "")
        timeout = args.get("timeout", 30)
        if not command:
            return ToolResult(False, error="No command provided")

        result = await sandbox.exec_command(command, timeout=timeout)
        return ToolResult(
            result.exit_code == 0,
            output=result.truncated(),
            error=result.stderr if result.exit_code != 0 else "",
        )

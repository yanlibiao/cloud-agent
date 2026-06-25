"""Base tool interface."""
from abc import ABC, abstractmethod

from app.sandbox.manager import SandboxManager, SandboxResult


class ToolResult:
    def __init__(self, success: bool, output: str = "", error: str = ""):
        self.success = success
        self.output = output
        self.error = error

    def to_text(self) -> str:
        if self.success:
            return self.output
        return f"Error: {self.error}"


class BaseTool(ABC):
    name: str = ""
    description: str = ""
    requires_approval: bool = False

    @abstractmethod
    async def run(self, sandbox, args: dict) -> ToolResult:
        ...

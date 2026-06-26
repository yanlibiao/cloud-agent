"""Tool registry — maps tool names to their implementations."""
from app.tools.base import BaseTool
from app.tools.exec_command import ExecCommandTool
from app.tools.write_file import WriteFileTool
from app.tools.read_file import ReadFileTool
from app.tools.list_dir import ListDirTool
from app.tools.grep_files import GrepFilesTool
from app.tools.apply_patch import ApplyPatchTool
from app.tools.web_search import WebSearchTool


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool

    def get(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def get_all(self) -> list[BaseTool]:
        return list(self._tools.values())

    async def execute(self, name: str, args: dict, sandbox) -> str:
        tool = self.get(name)
        if not tool:
            return f"Error: Unknown tool '{name}'"
        result = await tool.run(sandbox, args)
        return result.to_text()


def create_default_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(ExecCommandTool())
    registry.register(WriteFileTool())
    registry.register(ReadFileTool())
    registry.register(ListDirTool())
    registry.register(GrepFilesTool())
    registry.register(ApplyPatchTool())
    registry.register(WebSearchTool())
    return registry

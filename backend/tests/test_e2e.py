"""Quick end-to-end test of the agent loop with DeepSeek."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.agent.loop import AgentLoop
from app.config import settings
from app.llm.client import LLMClient
from app.sandbox.manager import LocalSandboxSession
from app.tools.registry import create_default_registry

print(f"Model: {settings.llm_model}")
print(f"API Key set: {bool(settings.openai_api_key)}")
print(f"Base URL: {settings.openai_base_url}")


async def test_direct_llm():
    """Test that LLM client can respond."""
    print("\n=== Test 1: Direct LLM call ===")
    llm = LLMClient()
    try:
        async for event in llm.stream(
            [{"role": "user", "content": "Say hello in one word."}]
        ):
            if event["type"] == "text_delta":
                print(event["text"], end="", flush=True)
            elif event["type"] == "done":
                print()
        print("Pass: Direct LLM call works")
    except Exception as e:
        print(f"Fail: LLM call failed: {e}")
        return False
    return True


async def test_agent_loop():
    """Test the full agent loop with a simple tool call."""
    print("\n=== Test 2: Agent loop with write_file ===")

    import tempfile
    import uuid
    import shutil
    ws = os.path.join(tempfile.gettempdir(), f"agent-test-{uuid.uuid4().hex[:8]}")
    os.makedirs(ws, exist_ok=True)
    sandbox = LocalSandboxSession("test", ws)
    print(f"Workspace: {ws}")

    llm = LLMClient()
    tools = create_default_registry()
    loop = AgentLoop(llm=llm, tools=tools)

    try:
        async for event in loop.run_turn(
            'Create a file called "hello.txt" with content "Hello from Agent!" using write_file',
            sandbox,
        ):
            if event.type == "agent_text_delta":
                print(event.data.get("text", ""), end="", flush=True)
            elif event.type == "tool_call_begin":
                tc = event.data
                print(f"\nTool call: {tc.get('tool_name')}({tc.get('args')})")
            elif event.type == "tool_call_end":
                tc = event.data
                result = tc.get("result", "")
                print(f"\nTool result ({tc.get('tool_name')}): {result[:200]}")
            elif event.type == "turn_completed":
                print(f"\nTurn completed: {event.data.get('text', '')[:200]}")
            elif event.type == "error":
                print(f"\nError: {event.data.get('message', '')}")

        # Verify the file exists
        hello_path = os.path.join(ws, "hello.txt")
        if os.path.exists(hello_path):
            with open(hello_path, "r") as f:
                content = f.read()
            print(f"\nPass: hello.txt created with content: {content}")
        else:
            print("\nFAIL: hello.txt was NOT created")
    except Exception as e:
        print(f"FAIL: Agent loop failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    shutil.rmtree(ws, ignore_errors=True)
    return True


async def main():
    ok = await test_direct_llm()
    if ok:
        await test_agent_loop()


if __name__ == "__main__":
    asyncio.run(main())

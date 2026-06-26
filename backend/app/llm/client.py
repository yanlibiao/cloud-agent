"""LLM client abstraction. MVP: only OpenAI."""
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.config import settings


class LLMClient:
    """Minimal LLM client wrapping OpenAI streaming. Lazily initializes the API client."""

    def __init__(self):
        self._client: AsyncOpenAI | None = None
        self.model = settings.llm_model

    def _ensure_client(self) -> AsyncOpenAI:
        if self._client is None:
            if not settings.openai_api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY not set. Please set it in .env or environment variables."
                )
            self._client = AsyncOpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
            )
        return self._client

    async def generate(
        self,
        messages: list[dict],
        max_tokens: int = 100,
    ) -> str:
        """Non-streaming completion. Returns the full response text."""
        client = self._ensure_client()
        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def stream(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream a completion. Yields events:
        {"type": "text_delta", "text": "..."}
        {"type": "tool_calls", "calls": [{"id": "...", "name": "...", "args": {...}}, ...]}
        {"type": "done"}
        """
        client = self._ensure_client()

        kwargs = dict(
            model=self.model,
            messages=messages,
            stream=True,
            stream_options={"include_usage": True},
        )

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await client.chat.completions.create(**kwargs)

        tool_calls_buffer: dict[int, dict] = {}

        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            finish_reason = chunk.choices[0].finish_reason if chunk.choices else None

            if delta and delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_buffer:
                        tool_calls_buffer[idx] = {
                            "id": tc.id or "",
                            "name": tc.function.name or "",
                            "args": tc.function.arguments or "",
                        }
                    else:
                        if tc.id:
                            tool_calls_buffer[idx]["id"] = tc.id
                        if tc.function and tc.function.name:
                            tool_calls_buffer[idx]["name"] = tc.function.name
                        if tc.function and tc.function.arguments:
                            tool_calls_buffer[idx]["args"] += tc.function.arguments

            if delta and delta.content:
                yield {"type": "text_delta", "text": delta.content}

            if finish_reason == "tool_calls":
                import json

                calls = []
                for idx in sorted(tool_calls_buffer.keys()):
                    buf = tool_calls_buffer[idx]
                    try:
                        parsed_args = json.loads(buf["args"]) if buf["args"] else {}
                    except json.JSONDecodeError:
                        parsed_args = {"raw_args": buf["args"]}
                    calls.append({
                        "id": buf["id"],
                        "name": buf["name"],
                        "args": parsed_args,
                    })
                yield {"type": "tool_calls", "calls": calls}
                tool_calls_buffer.clear()

            if finish_reason == "stop":
                yield {"type": "done"}
                return

        yield {"type": "done"}

"""Tool: search the web using DuckDuckGo (free, no API key needed)."""
from typing import Any

import httpx
from parsel import Selector

from app.tools.base import BaseTool, ToolResult

DUCKDUCKGO_URL = "https://html.duckduckgo.com/html/"
USER_AGENT = "Mozilla/5.0 (compatible; CloudAgent/1.0; +https://github.com/yanlibiao/cloud-agent)"


async def _duckduckgo_search(query: str, max_results: int = 8) -> list[dict]:
    """Search DuckDuckGo and return a list of {title, snippet, url}."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.post(
            DUCKDUCKGO_URL,
            data={"q": query},
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()

    sel = Selector(text=resp.text)
    results = []
    for li in sel.css(".result")[:max_results]:
        title_el = li.css(".result__title a")
        snippet_el = li.css(".result__snippet")
        if title_el:
            results.append({
                "title": title_el.css("::text").get("").strip(),
                "snippet": snippet_el.css("::text").get("").strip(),
                "url": title_el.attrib.get("href", ""),
            })
    return results


class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Search the web using DuckDuckGo. Returns a list of results with title, snippet, and URL."
    requires_approval = False

    async def run(self, sandbox, args: dict[str, Any]) -> ToolResult:
        query = args.get("query", "")
        max_results = min(args.get("max_results", 8), 15)
        if not query:
            return ToolResult(False, error="No search query provided")

        try:
            results = await _duckduckgo_search(query, max_results)
            if not results:
                return ToolResult(True, output="No results found for query: " + query)

            lines = [f"Web search results for: {query}", ""]
            for i, r in enumerate(results, 1):
                lines.append(f"{i}. {r['title']}")
                lines.append(f"   {r['snippet']}")
                lines.append(f"   URL: {r['url']}")
                lines.append("")
            return ToolResult(True, output="\n".join(lines))
        except Exception as e:
            return ToolResult(False, error=f"Web search failed: {e}")

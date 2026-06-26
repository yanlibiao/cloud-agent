"""Tool: search the web using Bing (accessible from China, no API key needed)."""
from typing import Any

import httpx
from parsel import Selector

from app.tools.base import BaseTool, ToolResult

BING_URL = "https://cn.bing.com/search"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


async def _bing_search(query: str, max_results: int = 8) -> list[dict]:
    """Search Bing and return a list of {title, snippet, url}."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(
            BING_URL,
            params={"q": query, "mkt": "zh-CN"},
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()

    sel = Selector(text=resp.text)
    results = []

    # Bing search results are in <li class="b_algo">
    for li in sel.css(".b_algo")[:max_results]:
        title_el = li.css("h2 a")
        snippet_el = li.css(".b_caption p")
        if title_el:
            results.append({
                "title": title_el.css("::text").get("").strip(),
                "snippet": snippet_el.css("::text").get("").strip(),
                "url": title_el.attrib.get("href", ""),
            })
    return results


class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Search the web using Bing. Use this when you need current information, news, documentation, or anything that requires internet access. Returns up to 8 results with title, snippet, and URL."
    requires_approval = False

    async def run(self, sandbox, args: dict[str, Any]) -> ToolResult:
        query = args.get("query", "")
        max_results = min(args.get("max_results", 8), 15)
        if not query:
            return ToolResult(False, error="No search query provided")

        try:
            results = await _bing_search(query, max_results)
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

from __future__ import annotations

import os
import re
from html import unescape
from typing import Any
from urllib.parse import quote_plus

import httpx

_SEARCH_LINK_PATTERN = re.compile(
    r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_TAG_PATTERN = re.compile(r"<[^>]+>")


class WebSearchError(RuntimeError):
    pass


def web_search_enabled() -> bool:
    return os.getenv("CODEFORGE_WEB_SEARCH_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}


def _clean_html(text: str) -> str:
    return unescape(_TAG_PATTERN.sub("", text)).strip()


async def _search_brave(query: str, limit: int) -> list[dict[str, str]]:
    api_key = os.getenv("BRAVE_SEARCH_API_KEY", "").strip()
    if not api_key:
        return []

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": str(limit)},
            headers={"Accept": "application/json", "X-Subscription-Token": api_key},
        )
    if response.status_code >= 400:
        return []

    payload = response.json()
    results: list[dict[str, str]] = []
    for item in (payload.get("web", {}) or {}).get("results", [])[:limit]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        url = str(item.get("url", "")).strip()
        snippet = str(item.get("description", "")).strip()
        if title and url:
            results.append({"title": title, "url": url, "snippet": snippet, "source": "brave"})
    return results


async def _search_duckduckgo_instant(query: str) -> list[dict[str, str]]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_redirect": 1, "no_html": 1},
        )
    if response.status_code >= 400:
        return []

    payload = response.json()
    results: list[dict[str, str]] = []
    abstract = str(payload.get("AbstractText", "")).strip()
    abstract_url = str(payload.get("AbstractURL", "")).strip()
    heading = str(payload.get("Heading", "")).strip() or query
    if abstract and abstract_url:
        results.append(
            {
                "title": heading,
                "url": abstract_url,
                "snippet": abstract,
                "source": "duckduckgo",
            }
        )

    related = payload.get("RelatedTopics") or []
    for item in related:
        if not isinstance(item, dict):
            continue
        text = str(item.get("Text", "")).strip()
        url = str(item.get("FirstURL", "")).strip()
        if text and url:
            results.append({"title": text.split(" - ")[0][:120], "url": url, "snippet": text, "source": "duckduckgo"})
        if isinstance(item.get("Topics"), list):
            for nested in item["Topics"]:
                if not isinstance(nested, dict):
                    continue
                text = str(nested.get("Text", "")).strip()
                url = str(nested.get("FirstURL", "")).strip()
                if text and url:
                    results.append(
                        {"title": text.split(" - ")[0][:120], "url": url, "snippet": text, "source": "duckduckgo"}
                    )
    return results


async def _search_duckduckgo_html(query: str, limit: int) -> list[dict[str, str]]:
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        response = await client.post(
            "https://html.duckduckgo.com/html/",
            data={"q": query},
            headers={"User-Agent": "CodeForge/1.0"},
        )
    if response.status_code >= 400:
        return []

    html = response.text
    results: list[dict[str, str]] = []
    for match in _SEARCH_LINK_PATTERN.finditer(html):
        url = match.group(1).strip()
        title = _clean_html(match.group(2))
        if not url or not title or url.startswith("//duckduckgo.com"):
            continue
        results.append({"title": title[:160], "url": url, "snippet": "", "source": "duckduckgo_html"})
        if len(results) >= limit:
            break
    return results


async def search_web(query: str, *, limit: int = 5) -> dict[str, Any]:
    cleaned = query.strip()
    if not cleaned:
        raise WebSearchError("Search query is required")
    if not web_search_enabled():
        raise WebSearchError("Web search is disabled")

    capped = max(1, min(limit, 10))
    results: list[dict[str, str]] = []

    brave_results = await _search_brave(cleaned, capped)
    results.extend(brave_results)

    if len(results) < capped:
        for item in await _search_duckduckgo_instant(cleaned):
            if item["url"] not in {entry["url"] for entry in results}:
                results.append(item)
            if len(results) >= capped:
                break

    if len(results) < capped:
        for item in await _search_duckduckgo_html(cleaned, capped - len(results)):
            if item["url"] not in {entry["url"] for entry in results}:
                results.append(item)

    return {
        "query": cleaned,
        "result_count": len(results[:capped]),
        "results": results[:capped],
        "provider": results[0]["source"] if results else "none",
    }


def format_search_context(payload: dict[str, Any]) -> str:
    lines = [f"Web search: {payload.get('query', '')}"]
    for index, item in enumerate(payload.get("results") or [], start=1):
        title = item.get("title", "result")
        url = item.get("url", "")
        snippet = item.get("snippet", "")
        lines.append(f"{index}. {title}")
        if url:
            lines.append(f"   {url}")
        if snippet:
            lines.append(f"   {snippet[:280]}")
    return "\n".join(lines)


def should_auto_search(prompt: str) -> bool:
    lowered = prompt.lower()
    triggers = (
        "syntax error",
        "import error",
        "module not found",
        "dependency",
        "how do i",
        "how to ",
        "documentation",
        "docs for",
        "can't find",
        "cannot find",
        "what is ",
        "error:",
        "traceback",
        "stack overflow",
        "npm err",
        "pip install",
    )
    return any(trigger in lowered for trigger in triggers)


def search_query_from_prompt(prompt: str) -> str:
    cleaned = prompt.strip()
    if len(cleaned) <= 120:
        return cleaned
    for line in cleaned.splitlines():
        if any(token in line.lower() for token in ("error", "import", "module", "dependency", "how to")):
            return line.strip()[:160]
    return cleaned[:160]

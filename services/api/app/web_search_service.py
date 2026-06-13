from __future__ import annotations

import asyncio
import os
import re
from html import unescape
from typing import Any
from urllib.parse import quote

import httpx

from .scrape_service import scrape_url_excerpt

_SEARCH_LINK_PATTERN = re.compile(
    r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_SNIPPET_PATTERN = re.compile(
    r'class="result__snippet"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_TAG_PATTERN = re.compile(r"<[^>]+>")
_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_WIKI_AGENT = "CodeForge/1.0 (https://codeforge.local; search@codeforge.local)"


class WebSearchError(RuntimeError):
    pass


def web_search_enabled() -> bool:
    return os.getenv("CODEFORGE_WEB_SEARCH_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}


def scraper_enrich_enabled() -> bool:
    return os.getenv("CODEFORGE_WEB_SEARCH_ENRICH", "true").strip().lower() in {"1", "true", "yes", "on"}


def _clean_html(text: str) -> str:
    return unescape(_TAG_PATTERN.sub("", text)).strip()


def _normalize_result_url(url: str) -> str:
    cleaned = url.strip()
    if cleaned.startswith("//"):
        return f"https:{cleaned}"
    return cleaned


def _dedupe_results(results: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for item in results:
        url = item.get("url", "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        unique.append(item)
    return unique


async def _search_stackexchange(query: str, limit: int) -> list[dict[str, str]]:
    """Free Stack Overflow / Stack Exchange API — no key required at low volume."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.stackexchange.com/2.3/search/advanced",
            params={
                "order": "desc",
                "sort": "relevance",
                "q": query,
                "site": "stackoverflow",
                "pagesize": str(limit),
                "filter": "withbody",
            },
            headers={"User-Agent": _USER_AGENT},
        )
    if response.status_code != 200:
        return []

    results: list[dict[str, str]] = []
    for item in response.json().get("items", [])[:limit]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        url = str(item.get("link", "")).strip()
        if not title or not url:
            continue
        body = _clean_html(str(item.get("body", "")))
        snippet = body[:320] if body else str(item.get("excerpt", "")).strip()[:320]
        results.append(
            {
                "title": title[:160],
                "url": url,
                "snippet": snippet,
                "source": "stackoverflow_api",
            }
        )
    return results


async def _search_wikipedia(query: str, limit: int) -> list[dict[str, str]]:
    """Free Wikipedia search API."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "format": "json",
                "srlimit": str(limit),
            },
            headers={"User-Agent": _WIKI_AGENT},
        )
    if response.status_code != 200:
        return []

    results: list[dict[str, str]] = []
    for item in response.json().get("query", {}).get("search", [])[:limit]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        if not title:
            continue
        slug = quote(title.replace(" ", "_"))
        snippet = _clean_html(str(item.get("snippet", "")))
        results.append(
            {
                "title": title[:160],
                "url": f"https://en.wikipedia.org/wiki/{slug}",
                "snippet": snippet[:320],
                "source": "wikipedia_api",
            }
        )
    return results


async def _search_mdn(query: str, limit: int) -> list[dict[str, str]]:
    """Free MDN documentation search for web/platform topics."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://developer.mozilla.org/api/v1/search",
            params={"q": query, "locale": "en-US"},
            headers={"User-Agent": _USER_AGENT},
        )
    if response.status_code != 200:
        return []

    results: list[dict[str, str]] = []
    for item in response.json().get("documents", [])[:limit]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        url = str(item.get("mdn_url", "")).strip()
        if not title or not url:
            continue
        if not url.startswith("http"):
            url = f"https://developer.mozilla.org{url}"
        summary = str(item.get("summary", "")).strip()
        results.append(
            {
                "title": title[:160],
                "url": url,
                "snippet": summary[:320],
                "source": "mdn_api",
            }
        )
    return results


async def _search_duckduckgo_html(query: str, limit: int) -> list[dict[str, str]]:
    """Scrape DuckDuckGo HTML when the endpoint accepts the request (no API key)."""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        response = await client.post(
            "https://html.duckduckgo.com/html/",
            data={"q": query},
            headers={"User-Agent": _USER_AGENT, "Referer": "https://duckduckgo.com/"},
        )
    if response.status_code != 200:
        return []

    html = response.text
    snippets = [_clean_html(match.group(1)) for match in _SNIPPET_PATTERN.finditer(html)]

    results: list[dict[str, str]] = []
    for index, match in enumerate(_SEARCH_LINK_PATTERN.finditer(html)):
        url = _normalize_result_url(match.group(1))
        title = _clean_html(match.group(2))
        if not url or not title or "duckduckgo.com" in url:
            continue
        snippet = snippets[index] if index < len(snippets) else ""
        results.append(
            {
                "title": title[:160],
                "url": url,
                "snippet": snippet[:320],
                "source": "duckduckgo_scraper",
            }
        )
        if len(results) >= limit:
            break
    return results


async def _search_duckduckgo_instant(query: str) -> list[dict[str, str]]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_redirect": 1, "no_html": 1},
            headers={"User-Agent": _USER_AGENT},
        )
    if response.status_code != 200:
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
                "source": "duckduckgo_instant",
            }
        )

    for item in payload.get("RelatedTopics") or []:
        if not isinstance(item, dict):
            continue
        text = str(item.get("Text", "")).strip()
        url = str(item.get("FirstURL", "")).strip()
        if text and url:
            results.append(
                {
                    "title": text.split(" - ")[0][:120],
                    "url": url,
                    "snippet": text,
                    "source": "duckduckgo_instant",
                }
            )
        for nested in item.get("Topics") or []:
            if not isinstance(nested, dict):
                continue
            text = str(nested.get("Text", "")).strip()
            url = str(nested.get("FirstURL", "")).strip()
            if text and url:
                results.append(
                    {
                        "title": text.split(" - ")[0][:120],
                        "url": url,
                        "snippet": text,
                        "source": "duckduckgo_instant",
                    }
                )
    return results


async def _enrich_results_with_scraper(results: list[dict[str, str]], *, max_pages: int = 2) -> None:
    """Fetch page excerpts for top results missing snippets (httpx scrape, zero cost)."""
    if not scraper_enrich_enabled():
        return

    targets = [item for item in results if not item.get("snippet")][:max_pages]
    if not targets:
        return

    async def _scrape_one(item: dict[str, str]) -> tuple[str, str]:
        try:
            excerpt = await scrape_url_excerpt(item["url"], limit=400)
            return item["url"], excerpt
        except Exception:
            return item["url"], ""

    scraped = await asyncio.gather(*[_scrape_one(item) for item in targets])
    by_url = {url: excerpt for url, excerpt in scraped if excerpt}
    for item in results:
        if not item.get("snippet") and item["url"] in by_url:
            item["snippet"] = by_url[item["url"]]
            item["source"] = f"{item['source']}+scrape"


async def search_web(query: str, *, limit: int = 5) -> dict[str, Any]:
    cleaned = query.strip()
    if not cleaned:
        raise WebSearchError("Search query is required")
    if not web_search_enabled():
        raise WebSearchError("Web search is disabled")

    capped = max(1, min(limit, 10))
    per_source = max(2, capped)

    stack_task = asyncio.create_task(_search_stackexchange(cleaned, per_source))
    wiki_task = asyncio.create_task(_search_wikipedia(cleaned, per_source))
    mdn_task = asyncio.create_task(_search_mdn(cleaned, per_source))
    ddg_html_task = asyncio.create_task(_search_duckduckgo_html(cleaned, capped))
    ddg_instant_task = asyncio.create_task(_search_duckduckgo_instant(cleaned))

    stack_results, wiki_results, mdn_results, ddg_html, ddg_instant = await asyncio.gather(
        stack_task,
        wiki_task,
        mdn_task,
        ddg_html_task,
        ddg_instant_task,
    )

    merged = _dedupe_results(stack_results + wiki_results + mdn_results + ddg_html + ddg_instant)
    trimmed = merged[:capped]
    await _enrich_results_with_scraper(trimmed)

    provider = trimmed[0]["source"] if trimmed else "none"
    return {
        "query": cleaned,
        "result_count": len(trimmed),
        "results": trimmed,
        "provider": provider,
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

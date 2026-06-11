from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx


class ScrapeError(RuntimeError):
    pass


def _safe_excerpt(text: str, limit: int = 1200) -> str:
    trimmed = text.strip()
    if len(trimmed) <= limit:
        return trimmed
    return f"{trimmed[:limit]}\n...[truncated]"


def _validate_http_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ScrapeError("Scrape URL tasks require an http(s) URL")
    return url.strip()


def scrape_enabled() -> bool:
    return os.getenv("CODEFORGE_SCRAPE_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}


def _resolve_model_name() -> str:
    configured = os.getenv("CODEFORGE_SCRAPE_MODEL", "").strip()
    if configured:
        return configured
    synthesis = os.getenv("CODEFORGE_SYNTHESIS_MODEL", "gpt-4o-mini").strip()
    if "/" in synthesis:
        return synthesis
    return f"openai/{synthesis}"


def _build_graph_config() -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ScrapeError("OPENAI_API_KEY is required for ScrapeGraphAI extraction")

    base_url = os.getenv("OPENAI_BASE_URL", "").strip()
    llm_config: dict[str, Any] = {
        "api_key": api_key,
        "model": _resolve_model_name(),
        "temperature": 0,
    }
    if base_url:
        llm_config["base_url"] = base_url.rstrip("/")

    return {
        "llm": llm_config,
        "verbose": os.getenv("CODEFORGE_SCRAPE_VERBOSE", "false").strip().lower() in {"1", "true", "yes", "on"},
        "headless": True,
    }


def _resolve_source(*, project_path: str, url: str | None, source_path: str | None) -> tuple[str, str]:
    if url and source_path:
        raise ScrapeError("Provide either url or source_path, not both")
    if url:
        validated = _validate_http_url(url)
        return validated, "url"
    if source_path:
        root = Path(project_path).expanduser().resolve()
        candidate = Path(source_path).expanduser()
        resolved = candidate.resolve() if candidate.is_absolute() else (root / candidate).resolve()
        try:
            resolved.relative_to(root)
        except ValueError as exc:
            raise ScrapeError("source_path must stay inside the project workspace") from exc
        if not resolved.exists() or not resolved.is_file():
            raise ScrapeError("source_path does not exist or is not a file")
        return resolved.as_posix(), "file"
    raise ScrapeError("Scrape tasks require url or source_path")


def _import_smart_scraper():
    try:
        from scrapegraphai.graphs import SmartScraperGraph
    except ImportError as exc:
        raise ScrapeError(
            "scrapegraphai is not installed. Add it to the API image or run: pip install scrapegraphai"
        ) from exc
    return SmartScraperGraph


def _run_smart_scraper(*, prompt: str, source: str, config: dict[str, Any]) -> dict[str, Any]:
    SmartScraperGraph = _import_smart_scraper()
    scraper = SmartScraperGraph(prompt=prompt.strip(), source=source, config=config)
    result = scraper.run()
    if isinstance(result, dict):
        return result
    if isinstance(result, str):
        try:
            parsed = json.loads(result)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {"content": result}
    return {"content": str(result)}


async def _fallback_fetch_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        response = await client.get(url)
    if response.status_code >= 400:
        raise ScrapeError(f"Failed to fetch URL with status {response.status_code}")
    return response.text


async def run_scrape_extraction(
    *,
    project_path: str,
    scrape_prompt: str,
    url: str | None = None,
    source_path: str | None = None,
) -> dict[str, Any]:
    if not scrape_enabled():
        raise ScrapeError("ScrapeGraphAI extraction is disabled (CODEFORGE_SCRAPE_ENABLED=false)")

    cleaned_prompt = (scrape_prompt or "").strip()
    if not cleaned_prompt:
        raise ScrapeError("scrape_prompt cannot be empty")

    source, source_kind = _resolve_source(project_path=project_path, url=url, source_path=source_path)
    warnings: list[str] = []
    engine = "scrapegraphai"

    try:
        config = _build_graph_config()
        result = await asyncio.to_thread(
            _run_smart_scraper,
            prompt=cleaned_prompt,
            source=source,
            config=config,
        )
    except ScrapeError:
        raise
    except Exception as exc:
        if source_kind != "url":
            raise ScrapeError(f"ScrapeGraphAI extraction failed: {exc}") from exc
        warnings.append(f"ScrapeGraphAI failed ({exc}); used httpx fallback summary only")
        engine = "httpx_fallback"
        body = await _fallback_fetch_text(source)
        host = urlparse(source).netloc or source
        result = {
            "source": source,
            "prompt": cleaned_prompt,
            "fallback_excerpt": _safe_excerpt(body, limit=2000),
            "note": "Structured LLM extraction unavailable; raw page excerpt captured instead",
        }

    serialized = json.dumps(result, ensure_ascii=True, indent=2)
    return {
        "status": "completed",
        "summary": f"Scraped {source_kind} source with {engine}",
        "engine": engine,
        "source": source,
        "source_kind": source_kind,
        "prompt": cleaned_prompt,
        "result": result,
        "text_excerpt": _safe_excerpt(serialized, limit=2400),
        "warnings": warnings,
    }

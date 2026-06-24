"""Server-safe Agent Reach channels — web, YouTube, RSS, GitHub, Exa, Bilibili, Firecrawl."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import httpx

_JINA_BASE = "https://r.jina.ai/"
_GITHUB_API = "https://api.github.com"
_EXA_API = "https://api.exa.ai/search"
_BILIBILI_SEARCH_API = "https://api.bilibili.com/x/web-interface/search/type"
_FIRECRAWL_API = "https://api.firecrawl.dev/v1"
_USER_AGENT = "CodeForge-AgentReach/1.0"
_BILI_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


class AgentReachError(RuntimeError):
    pass


def _env_enabled(name: str, default: str = "true") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def channel_web_enabled() -> bool:
    return _env_enabled("CODEFORGE_AGENT_REACH_WEB")


def channel_youtube_enabled() -> bool:
    return _env_enabled("CODEFORGE_AGENT_REACH_YOUTUBE")


def channel_rss_enabled() -> bool:
    return _env_enabled("CODEFORGE_AGENT_REACH_RSS")


def channel_github_enabled() -> bool:
    return _env_enabled("CODEFORGE_AGENT_REACH_GITHUB")


def channel_exa_enabled() -> bool:
    return _env_enabled("CODEFORGE_AGENT_REACH_EXA") and bool(os.getenv("EXA_API_KEY", "").strip())


def channel_bilibili_enabled() -> bool:
    return _env_enabled("CODEFORGE_AGENT_REACH_BILIBILI")


def channel_firecrawl_enabled() -> bool:
    return _env_enabled("CODEFORGE_AGENT_REACH_FIRECRAWL") and bool(os.getenv("FIRECRAWL_API_KEY", "").strip())


def _exa_api_key() -> str:
    key = os.getenv("EXA_API_KEY", "").strip()
    if not key:
        raise AgentReachError("EXA_API_KEY is not configured")
    return key


def _firecrawl_api_key() -> str:
    key = os.getenv("FIRECRAWL_API_KEY", "").strip()
    if not key:
        raise AgentReachError("FIRECRAWL_API_KEY is not configured")
    return key


def _validate_http_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AgentReachError("url must be a valid http(s) URL")
    return url.strip()


def _truncate(text: str, limit: int = 12000) -> str:
    cleaned = text.strip()
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[:limit]}\n...[truncated]"


async def fetch_web(url: str) -> dict[str, Any]:
    if not channel_web_enabled():
        raise AgentReachError("Web fetch channel is disabled (CODEFORGE_AGENT_REACH_WEB)")
    target = _validate_http_url(url)
    jina_url = f"{_JINA_BASE}{quote(target, safe=':/?#[]@!$&\'()*+,;=')}"
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(jina_url, headers={"User-Agent": _USER_AGENT, "Accept": "text/plain"})
    if response.status_code >= 400:
        raise AgentReachError(f"Jina Reader failed with status {response.status_code}")
    content = _truncate(response.text)
    return {"ok": True, "url": target, "source": "jina_reader", "content": content, "length": len(content)}


def _youtube_url(url: str) -> str:
    target = _validate_http_url(url)
    host = urlparse(target).netloc.lower()
    if "youtube.com" not in host and "youtu.be" not in host:
        raise AgentReachError("url must be a YouTube watch or youtu.be link")
    return target


def _parse_vtt(vtt_path: Path) -> str:
    if not vtt_path.exists():
        return ""
    lines: list[str] = []
    for raw in vtt_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("WEBVTT") or "-->" in line or line.isdigit():
            continue
        if line.startswith("NOTE"):
            continue
        lines.append(line)
    # De-dupe consecutive identical caption lines
    deduped: list[str] = []
    for line in lines:
        if not deduped or deduped[-1] != line:
            deduped.append(line)
    return "\n".join(deduped)


def youtube_transcript(url: str, *, lang: str = "en") -> dict[str, Any]:
    if not channel_youtube_enabled():
        raise AgentReachError("YouTube channel is disabled (CODEFORGE_AGENT_REACH_YOUTUBE)")
    target = _youtube_url(url)
    ytdlp = shutil.which("yt-dlp")
    if not ytdlp:
        raise AgentReachError("yt-dlp is not installed on the server")

    with tempfile.TemporaryDirectory(prefix="cf-ytdlp-") as tmp:
        out_tpl = str(Path(tmp) / "subs")
        cmd = [
            ytdlp,
            "--skip-download",
            "--write-sub",
            "--write-auto-sub",
            "--sub-lang",
            lang,
            "--sub-format",
            "vtt",
            "-o",
            out_tpl,
            target,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=False)
        except subprocess.TimeoutExpired as exc:
            raise AgentReachError("yt-dlp timed out") from exc
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "yt-dlp failed").strip()
            raise AgentReachError(detail[:500])

        vtt_files = sorted(Path(tmp).glob("*.vtt"))
        if not vtt_files:
            raise AgentReachError("No subtitles found for this video")
        transcript = _parse_vtt(vtt_files[0])
        if not transcript:
            raise AgentReachError("Subtitle file was empty")
        return {
            "ok": True,
            "url": target,
            "source": "yt-dlp",
            "language": lang,
            "transcript": _truncate(transcript, 20000),
            "length": len(transcript),
        }


def rss_read(url: str, *, limit: int = 15) -> dict[str, Any]:
    if not channel_rss_enabled():
        raise AgentReachError("RSS channel is disabled (CODEFORGE_AGENT_REACH_RSS)")
    feed_url = _validate_http_url(url)
    try:
        import feedparser
    except ImportError as exc:
        raise AgentReachError("feedparser is not installed") from exc

    parsed = feedparser.parse(feed_url)
    if getattr(parsed, "bozo", False) and not parsed.entries:
        exc = getattr(parsed, "bozo_exception", None)
        raise AgentReachError(f"Failed to parse RSS feed: {exc or 'unknown error'}")

    entries: list[dict[str, Any]] = []
    for entry in parsed.entries[: max(1, min(limit, 50))]:
        entries.append(
            {
                "title": str(getattr(entry, "title", "") or ""),
                "link": str(getattr(entry, "link", "") or ""),
                "published": str(getattr(entry, "published", getattr(entry, "updated", "")) or ""),
                "summary": _truncate(str(getattr(entry, "summary", "") or ""), 500),
            }
        )
    return {
        "ok": True,
        "url": feed_url,
        "source": "feedparser",
        "feed_title": str(getattr(parsed.feed, "title", "") or ""),
        "entry_count": len(entries),
        "entries": entries,
    }


_REPO_PATTERN = re.compile(r"github\.com[/:](?P<owner>[\w.-]+)/(?P<repo>[\w.-]+)")


def _parse_github_repo(repo: str) -> tuple[str, str]:
    cleaned = repo.strip().rstrip("/")
    if cleaned.startswith("http"):
        match = _REPO_PATTERN.search(cleaned)
        if not match:
            raise AgentReachError("Could not parse GitHub repository from URL")
        return match.group("owner"), match.group("repo").removesuffix(".git")
    if "/" not in cleaned:
        raise AgentReachError("repo must be owner/name or a github.com URL")
    owner, name = cleaned.split("/", 1)
    return owner.strip(), name.strip().removesuffix(".git")


async def exa_search(
    query: str,
    *,
    limit: int = 8,
    search_type: str = "auto",
) -> dict[str, Any]:
    if not channel_exa_enabled():
        raise AgentReachError(
            "Exa search is disabled — set EXA_API_KEY and CODEFORGE_AGENT_REACH_EXA=true"
        )
    cleaned = query.strip()
    if not cleaned:
        raise AgentReachError("query is required")
    payload = {
        "query": cleaned,
        "numResults": max(1, min(limit, 20)),
        "type": search_type if search_type in {"auto", "neural", "keyword"} else "auto",
        "contents": {"text": {"maxCharacters": 1200}},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            _EXA_API,
            headers={"x-api-key": _exa_api_key(), "Content-Type": "application/json"},
            json=payload,
        )
    if response.status_code >= 400:
        detail = response.text[:300]
        raise AgentReachError(f"Exa API error {response.status_code}: {detail}")
    body = response.json()
    results: list[dict[str, Any]] = []
    for item in body.get("results") or []:
        if not isinstance(item, dict):
            continue
        results.append(
            {
                "title": item.get("title") or "",
                "url": item.get("url") or "",
                "published": item.get("publishedDate") or "",
                "author": item.get("author") or "",
                "score": item.get("score"),
                "text": _truncate(str(item.get("text") or ""), 1200),
            }
        )
    return {
        "ok": True,
        "query": cleaned,
        "source": "exa",
        "result_count": len(results),
        "results": results,
    }


async def bilibili_search(keyword: str, *, limit: int = 10) -> dict[str, Any]:
    if not channel_bilibili_enabled():
        raise AgentReachError("Bilibili channel is disabled (CODEFORGE_AGENT_REACH_BILIBILI)")
    cleaned = keyword.strip()
    if not cleaned:
        raise AgentReachError("keyword is required")

    bili_cli = shutil.which("bili")
    if bili_cli:
        try:
            result = subprocess.run(
                [bili_cli, "search", cleaned, "--type", "video", "--json"],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                payload = json.loads(result.stdout)
                items = payload if isinstance(payload, list) else payload.get("results") or payload.get("items") or []
                videos = []
                for item in items[: max(1, min(limit, 20))]:
                    if not isinstance(item, dict):
                        continue
                    videos.append(
                        {
                            "title": item.get("title") or item.get("name") or "",
                            "bvid": item.get("bvid") or item.get("id") or "",
                            "author": item.get("author") or item.get("up_name") or "",
                            "url": item.get("url")
                            or (
                                f"https://www.bilibili.com/video/{item.get('bvid')}"
                                if item.get("bvid")
                                else ""
                            ),
                            "description": _truncate(str(item.get("description") or item.get("desc") or ""), 300),
                        }
                    )
                return {
                    "ok": True,
                    "keyword": cleaned,
                    "source": "bili-cli",
                    "result_count": len(videos),
                    "videos": videos,
                }
        except (json.JSONDecodeError, subprocess.TimeoutExpired):
            pass

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        response = await client.get(
            _BILIBILI_SEARCH_API,
            params={"search_type": "video", "keyword": cleaned, "page": "1"},
            headers={
                "User-Agent": _BILI_USER_AGENT,
                "Referer": "https://www.bilibili.com",
            },
        )
    if response.status_code >= 400:
        raise AgentReachError(f"Bilibili search failed with status {response.status_code}")
    body = response.json()
    if body.get("code") not in {0, None}:
        raise AgentReachError(str(body.get("message") or "Bilibili search failed"))
    raw_items = ((body.get("data") or {}).get("result") or [])[: max(1, min(limit, 20))]
    videos: list[dict[str, Any]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        bvid = item.get("bvid") or ""
        videos.append(
            {
                "title": str(item.get("title") or "").replace("<em class=\"keyword\">", "").replace("</em>", ""),
                "bvid": bvid,
                "author": item.get("author") or "",
                "url": f"https://www.bilibili.com/video/{bvid}" if bvid else "",
                "description": _truncate(str(item.get("description") or ""), 300),
                "play": item.get("play"),
            }
        )
    return {
        "ok": True,
        "keyword": cleaned,
        "source": "bilibili_api",
        "result_count": len(videos),
        "videos": videos,
    }


async def firecrawl_scrape(url: str) -> dict[str, Any]:
    if not channel_firecrawl_enabled():
        raise AgentReachError(
            "Firecrawl is disabled — set FIRECRAWL_API_KEY and CODEFORGE_AGENT_REACH_FIRECRAWL=true"
        )
    target = _validate_http_url(url)
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{_FIRECRAWL_API}/scrape",
            headers={
                "Authorization": f"Bearer {_firecrawl_api_key()}",
                "Content-Type": "application/json",
            },
            json={"url": target, "formats": ["markdown"]},
        )
    if response.status_code >= 400:
        raise AgentReachError(f"Firecrawl scrape error {response.status_code}: {response.text[:300]}")
    body = response.json()
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    markdown = str(data.get("markdown") or data.get("content") or "")
    return {
        "ok": True,
        "url": target,
        "source": "firecrawl",
        "title": data.get("metadata", {}).get("title") if isinstance(data.get("metadata"), dict) else "",
        "markdown": _truncate(markdown, 20000),
        "length": len(markdown),
    }


async def firecrawl_search(query: str, *, limit: int = 5) -> dict[str, Any]:
    if not channel_firecrawl_enabled():
        raise AgentReachError(
            "Firecrawl is disabled — set FIRECRAWL_API_KEY and CODEFORGE_AGENT_REACH_FIRECRAWL=true"
        )
    cleaned = query.strip()
    if not cleaned:
        raise AgentReachError("query is required")
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{_FIRECRAWL_API}/search",
            headers={
                "Authorization": f"Bearer {_firecrawl_api_key()}",
                "Content-Type": "application/json",
            },
            json={"query": cleaned, "limit": max(1, min(limit, 10))},
        )
    if response.status_code >= 400:
        raise AgentReachError(f"Firecrawl search error {response.status_code}: {response.text[:300]}")
    body = response.json()
    raw = body.get("data") if isinstance(body.get("data"), list) else []
    results: list[dict[str, Any]] = []
    for item in raw[:limit]:
        if not isinstance(item, dict):
            continue
        results.append(
            {
                "title": item.get("title") or "",
                "url": item.get("url") or "",
                "markdown": _truncate(str(item.get("markdown") or ""), 1200),
            }
        )
    return {
        "ok": True,
        "query": cleaned,
        "source": "firecrawl",
        "result_count": len(results),
        "results": results,
    }


async def github_repo(repo: str) -> dict[str, Any]:
    if not channel_github_enabled():
        raise AgentReachError("GitHub channel is disabled (CODEFORGE_AGENT_REACH_GITHUB)")
    owner, name = _parse_github_repo(repo)
    api_url = f"{_GITHUB_API}/repos/{owner}/{name}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            api_url,
            headers={"User-Agent": _USER_AGENT, "Accept": "application/vnd.github+json"},
        )
    if response.status_code == 404:
        raise AgentReachError(f"Repository not found: {owner}/{name}")
    if response.status_code >= 400:
        raise AgentReachError(f"GitHub API error {response.status_code}")
    body = response.json()
    return {
        "ok": True,
        "repo": f"{owner}/{name}",
        "source": "github_api",
        "name": body.get("full_name"),
        "description": body.get("description") or "",
        "stars": body.get("stargazers_count"),
        "forks": body.get("forks_count"),
        "language": body.get("language"),
        "default_branch": body.get("default_branch"),
        "html_url": body.get("html_url"),
        "topics": body.get("topics") or [],
        "open_issues": body.get("open_issues_count"),
        "updated_at": body.get("updated_at"),
    }


async def probe_channel_status() -> dict[str, Any]:
    channels: dict[str, dict[str, Any]] = {}

    if channel_web_enabled():
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.head(_JINA_BASE, follow_redirects=True)
            channels["web"] = {"ok": response.status_code < 500, "backend": "jina_reader"}
        except Exception as exc:
            channels["web"] = {"ok": False, "backend": "jina_reader", "error": str(exc)[:200]}
    else:
        channels["web"] = {"ok": False, "disabled": True}

    if channel_youtube_enabled():
        ytdlp = shutil.which("yt-dlp")
        if ytdlp:
            try:
                version = subprocess.run(
                    [ytdlp, "--version"],
                    capture_output=True,
                    text=True,
                    timeout=10,
                    check=False,
                )
                channels["youtube"] = {
                    "ok": version.returncode == 0,
                    "backend": "yt-dlp",
                    "version": (version.stdout or "").strip(),
                }
            except Exception as exc:
                channels["youtube"] = {"ok": False, "backend": "yt-dlp", "error": str(exc)[:200]}
        else:
            channels["youtube"] = {"ok": False, "backend": "yt-dlp", "error": "yt-dlp not found"}
    else:
        channels["youtube"] = {"ok": False, "disabled": True}

    if channel_rss_enabled():
        try:
            import feedparser  # noqa: F401

            channels["rss"] = {"ok": True, "backend": "feedparser"}
        except ImportError:
            channels["rss"] = {"ok": False, "backend": "feedparser", "error": "feedparser not installed"}
    else:
        channels["rss"] = {"ok": False, "disabled": True}

    if channel_github_enabled():
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{_GITHUB_API}/rate_limit", headers={"User-Agent": _USER_AGENT})
            channels["github"] = {"ok": response.status_code == 200, "backend": "github_api"}
        except Exception as exc:
            channels["github"] = {"ok": False, "backend": "github_api", "error": str(exc)[:200]}
    else:
        channels["github"] = {"ok": False, "disabled": True}

    if channel_exa_enabled():
        channels["exa"] = {"ok": True, "backend": "exa_api", "configured": True}
    elif _env_enabled("CODEFORGE_AGENT_REACH_EXA") and not os.getenv("EXA_API_KEY", "").strip():
        channels["exa"] = {"ok": False, "backend": "exa_api", "error": "EXA_API_KEY missing"}
    else:
        channels["exa"] = {"ok": False, "disabled": True}

    if channel_bilibili_enabled():
        bili_cli = shutil.which("bili")
        channels["bilibili"] = {
            "ok": True,
            "backend": "bili-cli" if bili_cli else "bilibili_api",
            "cli_installed": bool(bili_cli),
        }
    else:
        channels["bilibili"] = {"ok": False, "disabled": True}

    if channel_firecrawl_enabled():
        channels["firecrawl"] = {"ok": True, "backend": "firecrawl_api", "configured": True}
    elif _env_enabled("CODEFORGE_AGENT_REACH_FIRECRAWL") and not os.getenv("FIRECRAWL_API_KEY", "").strip():
        channels["firecrawl"] = {"ok": False, "backend": "firecrawl_api", "error": "FIRECRAWL_API_KEY missing"}
    else:
        channels["firecrawl"] = {"ok": False, "disabled": True}

    ok_count = sum(1 for row in channels.values() if row.get("ok"))
    return {
        "status": "ok" if ok_count else "degraded",
        "channels": channels,
        "healthy_count": ok_count,
        "total_channels": len(channels),
    }

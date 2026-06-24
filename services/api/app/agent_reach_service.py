"""Server-safe Agent Reach channels — web, YouTube, RSS, GitHub (public API)."""

from __future__ import annotations

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
_USER_AGENT = "CodeForge-AgentReach/1.0"


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

    ok_count = sum(1 for row in channels.values() if row.get("ok"))
    return {
        "status": "ok" if ok_count else "degraded",
        "channels": channels,
        "healthy_count": ok_count,
        "total_channels": len(channels),
    }

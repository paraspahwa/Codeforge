from __future__ import annotations

import asyncio
import os
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import httpx

from . import cowork_store as store
from .shell_ops import ShellError, stream_shell_execution


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


_TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".log"}
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tiff", ".gif"}


class CoworkError(RuntimeError):
    pass


def _normalize_within_project(project_path: str, candidate: str) -> Path:
    root = Path(project_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise CoworkError("Project path does not exist")

    base = Path(candidate).expanduser()
    resolved = base.resolve() if base.is_absolute() else (root / base).resolve()

    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise CoworkError("Path must stay inside the project workspace") from exc

    if not resolved.exists():
        raise CoworkError("Path does not exist")

    return resolved


def _extract_entities(text: str) -> list[dict[str, str]]:
    entities: list[dict[str, str]] = []

    for line in text.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            if key and value:
                entities.append({"type": "key_value", "key": key, "value": value})

    for match in re.findall(r"\b[\w.%-]+@[\w.-]+\.[A-Za-z]{2,}\b", text):
        entities.append({"type": "email", "value": match})

    for match in re.findall(r"\b\d{10}\b", text):
        entities.append({"type": "phone", "value": match})

    deduped: list[dict[str, str]] = []
    seen = set()
    for entity in entities:
        key = tuple(sorted(entity.items()))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entity)

    return deduped[:30]


def _safe_excerpt(text: str, limit: int = 1200) -> str:
    trimmed = text.strip()
    if len(trimmed) <= limit:
        return trimmed
    return f"{trimmed[:limit]}\n...[truncated]"


def _validate_http_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise CoworkError("Browser tasks require an http(s) URL")
    return url.strip()


_APPROVAL_REQUIRED_TASKS = {"browser", "connector", "scrape"}
_JOB_ALLOWED_TASKS = {"shell", "extract"}


def _scrape_options(plan: dict[str, Any]) -> dict[str, Any]:
    args = dict(plan.get("connector_arguments") or {})
    return {
        "scrape_prompt": str(args.get("scrape_prompt") or plan.get("scrape_prompt") or "").strip(),
        "ingest_knowledge": bool(args.get("ingest_knowledge", True)),
        "ingest_memory": bool(args.get("ingest_memory", True)),
    }


async def _ingest_scrape_results(
    *,
    plan: dict[str, Any],
    user_id: str,
    details: dict[str, Any],
) -> dict[str, Any]:
    options = _scrape_options(plan)
    excerpt = str(details.get("text_excerpt") or "")
    if not excerpt:
        return details

    source_label = str(details.get("source") or "scrape")
    ingested: dict[str, Any] = {}

    if options["ingest_knowledge"]:
        from .projects_team import ProjectsTeamError, projects_team_service

        try:
            knowledge_state = projects_team_service.append_knowledge_snippet(
                user_id=user_id,
                session_id=str(plan["session_id"]),
                project_path=str(plan["project_path"]),
                path_label=source_label,
                excerpt=excerpt,
            )
            ingested["knowledge_id"] = knowledge_state["knowledge_id"]
            ingested["knowledge_path"] = f".codeforge/knowledge/uploads/scrape_{source_label}"
        except ProjectsTeamError as exc:
            details.setdefault("warnings", []).append(f"Knowledge ingest skipped: {exc}")

    if options["ingest_memory"]:
        from .memory_service import memory_service

        try:
            memory_row = memory_service.save_memory(
                user_id=user_id,
                content=f"Scrape ({source_label}): {excerpt[:900]}",
                project_path=str(plan.get("project_path") or ""),
                scope="team",
                kind="note",
                source_session_id=str(plan.get("session_id") or ""),
            )
            ingested["memory_id"] = memory_row["memory_id"]
        except ValueError as exc:
            details.setdefault("warnings", []).append(f"Memory ingest skipped: {exc}")

    if ingested:
        details["ingested"] = ingested
    return details


def extract_structured_data(project_path: str, source_path: str) -> dict[str, Any]:
    resolved = _normalize_within_project(project_path, source_path)
    suffix = resolved.suffix.lower()
    bytes_size = resolved.stat().st_size

    extracted_text = ""
    method = "none"
    warnings: list[str] = []

    if suffix in _TEXT_EXTENSIONS:
        extracted_text = resolved.read_text(encoding="utf-8", errors="replace")
        method = "plain_text"
    elif suffix in _IMAGE_EXTENSIONS:
        tesseract = shutil.which("tesseract")
        if tesseract:
            try:
                completed = subprocess.run(
                    [tesseract, str(resolved), "stdout"],
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=20,
                )
                extracted_text = completed.stdout or ""
                method = "tesseract_ocr"
                if completed.returncode != 0:
                    warnings.append("OCR completed with a non-zero return code")
            except Exception as exc:  # pragma: no cover - defensive fallback
                warnings.append(f"OCR failed: {exc}")
                method = "ocr_failed"
        else:
            method = "image_metadata"
            warnings.append("Tesseract was not found; OCR text is unavailable")
    else:
        extracted_text = resolved.read_text(encoding="utf-8", errors="replace")
        method = "best_effort_text"

    entities = _extract_entities(extracted_text)
    result_id = f"ext_{uuid4().hex[:12]}"
    created_at = utc_now().isoformat()

    return {
        "extraction_id": result_id,
        "source_path": resolved.as_posix(),
        "method": method,
        "byte_size": bytes_size,
        "text_excerpt": _safe_excerpt(extracted_text),
        "entities": entities,
        "warnings": warnings,
        "created_at": created_at,
    }


async def _run_shell_task(project_path: str, command: str) -> dict[str, Any]:
    output_lines: list[str] = []
    exit_code = 1

    try:
        async for event in stream_shell_execution(project_path, command, timeout_seconds=45):
            if event["type"] == "shell_output":
                content = str(event["payload"].get("content", ""))
                if content:
                    output_lines.append(content)
            if event["type"] == "shell_result":
                exit_code = int(event["payload"].get("exit_code", 1))
    except ShellError as exc:
        return {
            "status": "failed",
            "summary": str(exc),
            "output": "",
            "exit_code": 1,
        }

    return {
        "status": "completed" if exit_code == 0 else "failed",
        "summary": f"Shell command exited with code {exit_code}",
        "output": "\n".join(output_lines[-30:]),
        "exit_code": exit_code,
    }


def _collect_links(html: str, limit: int = 12) -> list[str]:
    links = []
    for match in re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.IGNORECASE):
        links.append(match)
        if len(links) >= limit:
            break
    return links


async def _run_browser_task_httpx(url: str, action: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(url)
    except Exception as exc:
        return {
            "status": "failed",
            "summary": f"Browser task failed: {exc}",
            "http_status": None,
            "title": "",
            "links": [],
            "engine": "httpx",
        }

    body = response.text
    title_match = re.search(r"<title>(.*?)</title>", body, flags=re.IGNORECASE | re.DOTALL)
    title = title_match.group(1).strip() if title_match else ""
    links = _collect_links(body)

    if action == "extract_links":
        summary = f"Fetched {url} and captured {len(links)} link(s)"
    else:
        summary = f"Fetched {url} and captured page title"

    return {
        "status": "completed",
        "summary": summary,
        "http_status": response.status_code,
        "title": title,
        "links": links,
        "engine": "httpx",
    }


def _screenshot_dir(project_path: str) -> Path:
    root = Path(project_path).expanduser().resolve()
    target = root / ".codeforge" / "cowork" / "screenshots"
    target.mkdir(parents=True, exist_ok=True)
    return target


async def _run_browser_task_playwright(
    url: str,
    action: str,
    *,
    project_path: str | None = None,
) -> dict[str, Any] | None:
    if os.getenv("CODEFORGE_DISABLE_PLAYWRIGHT", "").lower() in {"1", "true", "yes"}:
        return None

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return None

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            page = await browser.new_page()
            response = await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            title = await page.title()
            links: list[str] = []
            if action == "extract_links":
                links = await page.eval_on_selector_all(
                    "a[href]",
                    "elements => elements.map(element => element.href).filter(Boolean).slice(0, 12)",
                )

            screenshot_path = None
            screenshot_bytes = None
            ocr_text = ""
            ocr_method = ""
            ocr_warnings: list[str] = []

            if action in {"capture_screenshot", "screenshot_ocr", "vision_extract"} and project_path:
                screenshot_bytes = await page.screenshot(full_page=True, type="png")
                screenshot_file = _screenshot_dir(project_path) / f"shot_{uuid4().hex[:10]}.png"
                screenshot_file.write_bytes(screenshot_bytes)
                screenshot_path = screenshot_file.as_posix()

            if action in {"screenshot_ocr", "vision_extract"} and screenshot_bytes:
                from .vision_ocr import extract_text_from_image_bytes

                vision_prompt = (
                    "Extract visible UI text, labels, and key content from this browser screenshot."
                    if action == "vision_extract"
                    else "OCR this browser screenshot and return plain text."
                )
                ocr_result = await extract_text_from_image_bytes(screenshot_bytes, prompt=vision_prompt)
                ocr_text = str(ocr_result.get("text", ""))
                ocr_method = str(ocr_result.get("method", ""))
                ocr_warnings = list(ocr_result.get("warnings") or [])

            await browser.close()

            if action == "extract_links":
                summary = f"Playwright fetched {url} and captured {len(links)} link(s)"
            elif action == "capture_screenshot":
                summary = f"Playwright captured screenshot for {url}"
            elif action in {"screenshot_ocr", "vision_extract"}:
                summary = f"Playwright captured screenshot and extracted text ({ocr_method or 'none'})"
            else:
                summary = f"Playwright fetched {url} and captured page title"

            return {
                "status": "completed",
                "summary": summary,
                "http_status": response.status if response else None,
                "title": title,
                "links": links,
                "engine": "playwright",
                "screenshot_path": screenshot_path,
                "ocr_text": ocr_text,
                "ocr_method": ocr_method,
                "ocr_warnings": ocr_warnings,
            }
    except Exception as exc:
        return {
            "status": "failed",
            "summary": f"Playwright browser task failed: {exc}",
            "http_status": None,
            "title": "",
            "links": [],
            "engine": "playwright",
        }


async def _run_browser_task(url: str, action: str, *, project_path: str | None = None) -> dict[str, Any]:
    playwright_result = await _run_browser_task_playwright(url, action, project_path=project_path)
    if playwright_result is not None and playwright_result.get("status") == "completed":
        return playwright_result
    return await _run_browser_task_httpx(url, action)


class CoworkService:
    def __init__(self) -> None:
        self._worker_task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self._max_concurrent_runs = max(1, int(os.getenv("CODEFORGE_COWORK_MAX_CONCURRENT_RUNS", "3")))
        self._max_consecutive_failures = max(1, int(os.getenv("CODEFORGE_COWORK_MAX_CONSECUTIVE_FAILURES", "3")))
        self._run_semaphore = asyncio.Semaphore(self._max_concurrent_runs)

    async def start(self) -> None:
        if self._worker_task and not self._worker_task.done():
            return
        self._stop_event = asyncio.Event()
        self._worker_task = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        self._stop_event.set()
        if self._worker_task:
            await self._worker_task

    def list_plans(self, user_id: str) -> list[dict[str, Any]]:
        return store.list_plans(user_id)

    def list_runs(self, user_id: str) -> list[dict[str, Any]]:
        return store.list_runs(user_id)

    def list_jobs(self, user_id: str) -> list[dict[str, Any]]:
        return store.list_jobs(user_id)

    def list_extractions(self, user_id: str) -> list[dict[str, Any]]:
        return store.list_extractions(user_id)

    def create_plan(
        self,
        *,
        user_id: str,
        session_id: str,
        project_path: str,
        title: str,
        task_type: str,
        command: str | None,
        source_path: str | None,
        url: str | None,
        browser_action: str | None,
        connector_id: str | None = None,
        tool_name: str | None = None,
        connector_arguments: dict[str, Any] | None = None,
        scrape_prompt: str | None = None,
    ) -> dict[str, Any]:
        plan_id = f"cw_plan_{uuid4().hex[:10]}"
        requires_approval = task_type in _APPROVAL_REQUIRED_TASKS
        resolved_connector_arguments = dict(connector_arguments or {})
        if scrape_prompt:
            resolved_connector_arguments["scrape_prompt"] = scrape_prompt.strip()

        if task_type == "shell":
            if not command:
                raise CoworkError("Shell tasks require a command")
            preview_steps = [
                f"Validate sandbox command: {command}",
                "Run command in workspace sandbox",
                "Store output summary in cowork run history",
            ]
        elif task_type == "extract":
            if not source_path:
                raise CoworkError("Extraction tasks require a source path")
            preview_steps = [
                f"Resolve extraction source: {source_path}",
                "Run OCR or text extraction pipeline",
                "Store structured entities for follow-up tasks",
            ]
        elif task_type == "browser":
            if not url:
                raise CoworkError("Browser tasks require a URL")
            validated_url = _validate_http_url(url)
            preview_steps = [
                f"Load URL: {validated_url}",
                f"Action: {browser_action or 'capture_title'}",
                "Require explicit user approval before execution",
                "Store a visible browser task transcript",
            ]
            url = validated_url
        elif task_type == "connector":
            if not connector_id or not tool_name:
                raise CoworkError("Connector tasks require connector_id and tool_name")
            preview_steps = [
                f"Connector: {connector_id}",
                f"Tool: {tool_name}",
                "Require explicit user approval before execution",
                "Invoke only registered MCP connector tools",
                "Store connector invocation transcript in run history",
            ]
        elif task_type == "scrape":
            options = _scrape_options(
                {
                    "connector_arguments": resolved_connector_arguments,
                    "scrape_prompt": scrape_prompt,
                }
            )
            if not options["scrape_prompt"]:
                raise CoworkError("Scrape tasks require scrape_prompt")
            if not url and not source_path:
                raise CoworkError("Scrape tasks require url or source_path")
            if url:
                validated_url = _validate_http_url(url)
                preview_steps = [
                    f"Scrape URL: {validated_url}",
                    f"Prompt: {options['scrape_prompt'][:120]}",
                    "Run ScrapeGraphAI SmartScraperGraph",
                    "Require explicit user approval before execution",
                    "Ingest structured output into project knowledge and agent memory",
                ]
                url = validated_url
            else:
                preview_steps = [
                    f"Scrape local file: {source_path}",
                    f"Prompt: {options['scrape_prompt'][:120]}",
                    "Run ScrapeGraphAI SmartScraperGraph on workspace file",
                    "Require explicit user approval before execution",
                    "Ingest structured output into project knowledge and agent memory",
                ]
        else:
            raise CoworkError("Unsupported cowork task type")

        plan = {
            "plan_id": plan_id,
            "user_id": user_id,
            "session_id": session_id,
            "project_path": project_path,
            "title": title or f"Cowork {task_type} task",
            "task_type": task_type,
            "command": command,
            "source_path": source_path,
            "url": url,
            "browser_action": browser_action or "capture_title",
            "connector_id": connector_id,
            "tool_name": tool_name,
            "connector_arguments": resolved_connector_arguments,
            "scrape_prompt": resolved_connector_arguments.get("scrape_prompt"),
            "requires_approval": requires_approval,
            "preview_steps": preview_steps,
            "status": "planned",
            "created_at": utc_now().isoformat(),
        }
        store.save_plan(plan)
        return plan

    async def run_plan(self, *, user_id: str, plan_id: str, approved: bool, trigger: str = "manual") -> dict[str, Any]:
        plan = store.get_plan(plan_id)
        if plan is None or plan["user_id"] != user_id:
            raise CoworkError("Plan not found")

        if plan["requires_approval"] and trigger != "manual":
            raise CoworkError("Approval-required tasks cannot run from scheduled jobs")

        if plan["requires_approval"] and not approved:
            raise CoworkError("This task requires explicit approval before execution")

        run_id = f"cw_run_{uuid4().hex[:10]}"
        run = {
            "run_id": run_id,
            "plan_id": plan_id,
            "user_id": user_id,
            "task_type": plan["task_type"],
            "status": "running",
            "summary": "Task is running",
            "details": {},
            "created_at": utc_now().isoformat(),
            "completed_at": None,
            "trigger": trigger,
        }
        store.save_run(run)

        async with self._run_semaphore:
            details = await self._execute_plan_with_retries(plan=plan, user_id=user_id, trigger=trigger)

        run["status"] = str(details.get("status", "completed"))
        run["summary"] = str(details.get("summary", "Task completed"))
        run["details"] = details
        run["completed_at"] = utc_now().isoformat()
        store.update_run(
            run["run_id"],
            status=run["status"],
            summary=run["summary"],
            details=details,
            completed_at=run["completed_at"],
        )
        store.update_plan_status(plan_id, "completed" if run["status"] == "completed" else "failed")
        return run

    async def _execute_plan_once(self, *, plan: dict[str, Any], user_id: str) -> dict[str, Any]:
        details: dict[str, Any]
        if plan["task_type"] == "shell":
            details = await _run_shell_task(plan["project_path"], str(plan["command"]))
        elif plan["task_type"] == "extract":
            details = extract_structured_data(plan["project_path"], str(plan["source_path"]))
            details["status"] = "completed"
            store.save_extraction({**details, "user_id": user_id})
        elif plan["task_type"] == "connector":
            from .context_mcp import ContextMcpError, context_mcp_service

            try:
                invocation = context_mcp_service.invoke_connector(
                    user_id=user_id,
                    connector_id=str(plan["connector_id"]),
                    tool_name=str(plan["tool_name"]),
                    arguments=dict(plan.get("connector_arguments") or {}),
                )
                details = {
                    "status": "completed",
                    "summary": f"Connector tool {plan['tool_name']} invoked",
                    "invocation": invocation,
                }
            except ContextMcpError as exc:
                details = {
                    "status": "failed",
                    "summary": str(exc),
                    "invocation": {},
                }
        elif plan["task_type"] == "scrape":
            from .scrape_service import ScrapeError, run_scrape_extraction

            options = _scrape_options(plan)
            try:
                details = await run_scrape_extraction(
                    project_path=str(plan["project_path"]),
                    scrape_prompt=options["scrape_prompt"],
                    url=plan.get("url"),
                    source_path=plan.get("source_path"),
                )
                if str(details.get("status")) == "completed":
                    details = await _ingest_scrape_results(plan=plan, user_id=user_id, details=details)
                    extraction = {
                        "extraction_id": f"ext_{uuid4().hex[:12]}",
                        "source_path": str(details.get("source") or ""),
                        "method": str(details.get("engine") or "scrapegraphai"),
                        "byte_size": len(str(details.get("text_excerpt") or "").encode("utf-8")),
                        "text_excerpt": _safe_excerpt(str(details.get("text_excerpt") or "")),
                        "entities": _extract_entities(str(details.get("text_excerpt") or "")),
                        "warnings": list(details.get("warnings") or []),
                        "created_at": utc_now().isoformat(),
                    }
                    store.save_extraction({**extraction, "user_id": user_id})
                    details["extraction_id"] = extraction["extraction_id"]
            except ScrapeError as exc:
                details = {"status": "failed", "summary": str(exc)}
        else:
            details = await _run_browser_task(
                str(plan["url"]),
                str(plan["browser_action"]),
                project_path=str(plan.get("project_path") or ""),
            )
            if details.get("screenshot_path") and details.get("ocr_text"):
                extraction = {
                    "extraction_id": f"ext_{uuid4().hex[:12]}",
                    "source_path": str(details["screenshot_path"]),
                    "method": str(details.get("ocr_method") or "screenshot_ocr"),
                    "byte_size": 0,
                    "text_excerpt": _safe_excerpt(str(details.get("ocr_text") or "")),
                    "entities": _extract_entities(str(details.get("ocr_text") or "")),
                    "warnings": list(details.get("ocr_warnings") or []),
                    "created_at": utc_now().isoformat(),
                }
                store.save_extraction({**extraction, "user_id": user_id})
                details["extraction_id"] = extraction["extraction_id"]
        return details

    def _is_transient_failure(self, details: dict[str, Any]) -> bool:
        if str(details.get("status", "")).lower() == "completed":
            return False
        summary = str(details.get("summary", "")).lower()
        transient_markers = [
            "timeout",
            "timed out",
            "connection",
            "temporary",
            "unavailable",
            "502",
            "503",
            "504",
        ]
        return any(marker in summary for marker in transient_markers)

    async def _execute_plan_with_retries(self, *, plan: dict[str, Any], user_id: str, trigger: str) -> dict[str, Any]:
        attempts = 3 if trigger == "job" else 1
        backoff_seconds = 1.5
        details: dict[str, Any] = {"status": "failed", "summary": "Unknown failure"}

        for attempt in range(1, attempts + 1):
            details = await self._execute_plan_once(plan=plan, user_id=user_id)
            if str(details.get("status", "")).lower() == "completed":
                if attempt > 1:
                    details["summary"] = f"Recovered after retry {attempt - 1}: {details.get('summary', 'completed')}"
                return details

            if attempt == attempts or not self._is_transient_failure(details):
                break

            await asyncio.sleep(backoff_seconds)
            backoff_seconds *= 2

        return details

    def create_job(
        self,
        *,
        user_id: str,
        session_id: str,
        project_path: str,
        title: str,
        trigger_type: str,
        interval_seconds: int,
        watch_path: str | None,
        task_type: str,
        command: str | None,
        source_path: str | None,
        url: str | None,
        browser_action: str | None,
    ) -> dict[str, Any]:
        if trigger_type not in {"interval", "file_change"}:
            raise CoworkError("Unsupported trigger type")

        if task_type not in _JOB_ALLOWED_TASKS:
            raise CoworkError("Scheduled jobs only support shell and extraction tasks")

        if trigger_type == "interval" and interval_seconds < 5:
            raise CoworkError("Interval jobs must run every 5 seconds or more")

        watch_absolute = None
        watch_mtime = None
        if trigger_type == "file_change":
            if not watch_path:
                raise CoworkError("File-change jobs require watch_path")
            resolved = _normalize_within_project(project_path, watch_path)
            watch_absolute = resolved.as_posix()
            watch_mtime = resolved.stat().st_mtime

        job_id = f"cw_job_{uuid4().hex[:10]}"
        now = utc_now()
        job = {
            "job_id": job_id,
            "user_id": user_id,
            "session_id": session_id,
            "project_path": project_path,
            "title": title or "Cowork scheduled task",
            "trigger_type": trigger_type,
            "interval_seconds": interval_seconds,
            "watch_path": watch_path,
            "watch_absolute": watch_absolute,
            "watch_mtime": watch_mtime,
            "task_type": task_type,
            "command": command,
            "source_path": source_path,
            "url": url,
            "browser_action": browser_action or "capture_title",
            "enabled": True,
            "consecutive_failures": 0,
            "circuit_broken": False,
            "circuit_broken_reason": "",
            "next_run_at": (now + timedelta(seconds=interval_seconds)).isoformat() if trigger_type == "interval" else None,
            "last_run_at": None,
            "last_status": "never",
            "created_at": now.isoformat(),
        }
        store.save_job(job)
        return job

    def toggle_job(self, *, user_id: str, job_id: str, enabled: bool) -> dict[str, Any]:
        job = store.get_job(job_id)
        if job is None or job["user_id"] != user_id:
            raise CoworkError("Job not found")

        job["enabled"] = enabled
        if enabled:
            job["circuit_broken"] = False
            job["circuit_broken_reason"] = ""
            job["consecutive_failures"] = 0
        if enabled and job["trigger_type"] == "interval":
            interval = int(job["interval_seconds"])
            job["next_run_at"] = (utc_now() + timedelta(seconds=interval)).isoformat()
        store.update_job(job_id, job)
        return job

    def reliability_snapshot(self) -> dict[str, Any]:
        total_jobs, enabled_jobs, circuit_broken_jobs = store.count_jobs()
        running_jobs = store.count_running_runs()

        recent = store.list_recent_runs(50)
        recent_runs = len(recent)
        recent_failed_runs = sum(1 for item in recent if item.get("status") != "completed")
        recent_failure_rate = (recent_failed_runs / recent_runs) if recent_runs else 0.0
        reliability_alert = circuit_broken_jobs > 0 or recent_failure_rate >= 0.3

        alert_reason = ""
        if circuit_broken_jobs > 0:
            alert_reason = f"{circuit_broken_jobs} job(s) are circuit-broken due to repeated failures"
        elif reliability_alert:
            alert_reason = f"Recent failure rate {recent_failure_rate:.2f} exceeds reliability threshold"

        return {
            "max_concurrent_runs": self._max_concurrent_runs,
            "running_jobs": running_jobs,
            "total_jobs": total_jobs,
            "enabled_jobs": enabled_jobs,
            "circuit_broken_jobs": circuit_broken_jobs,
            "recent_runs": recent_runs,
            "recent_failed_runs": recent_failed_runs,
            "recent_failure_rate": recent_failure_rate,
            "reliability_alert": reliability_alert,
            "alert_reason": alert_reason,
        }

    async def tick_scheduled_jobs(self) -> None:
        await self._tick_jobs()

    async def _worker_loop(self) -> None:
        while not self._stop_event.is_set():
            await self.tick_scheduled_jobs()
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=2)
            except asyncio.TimeoutError:
                continue

    async def _tick_jobs(self) -> None:
        now = utc_now()

        for job in store.list_enabled_jobs():

            should_run = False

            if job["trigger_type"] == "interval":
                next_run_at_text = job.get("next_run_at")
                if next_run_at_text:
                    next_run_at = datetime.fromisoformat(next_run_at_text)
                    if now >= next_run_at:
                        should_run = True
            elif job["trigger_type"] == "file_change":
                watch_absolute = job.get("watch_absolute")
                if watch_absolute and Path(watch_absolute).exists():
                    mtime = Path(watch_absolute).stat().st_mtime
                    if job.get("watch_mtime") is None:
                        job["watch_mtime"] = mtime
                        store.update_job(job["job_id"], job)
                    elif mtime > float(job.get("watch_mtime", 0)):
                        should_run = True
                        job["watch_mtime"] = mtime

            if not should_run:
                continue

            plan = self.create_plan(
                user_id=job["user_id"],
                session_id=job["session_id"],
                project_path=job["project_path"],
                title=f"Job {job['title']}",
                task_type=job["task_type"],
                command=job.get("command"),
                source_path=job.get("source_path"),
                url=job.get("url"),
                browser_action=job.get("browser_action"),
            )

            run = await self.run_plan(
                user_id=job["user_id"],
                plan_id=plan["plan_id"],
                approved=True,
                trigger="job",
            )

            job["last_run_at"] = utc_now().isoformat()
            job["last_status"] = run["status"]
            if run["status"] == "completed":
                job["consecutive_failures"] = 0
            else:
                job["consecutive_failures"] = int(job.get("consecutive_failures", 0)) + 1
                if int(job["consecutive_failures"]) >= self._max_consecutive_failures:
                    job["enabled"] = False
                    job["circuit_broken"] = True
                    job["circuit_broken_reason"] = (
                        f"Automatically disabled after {job['consecutive_failures']} consecutive failures"
                    )
            if job["trigger_type"] == "interval":
                interval = int(job["interval_seconds"])
                job["next_run_at"] = (utc_now() + timedelta(seconds=interval)).isoformat()

            store.update_job(job["job_id"], job)


cowork_service = CoworkService()

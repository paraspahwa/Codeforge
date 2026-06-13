from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from .file_ops import (
    apply_proposed_content,
    infer_target_file,
    list_workspace_files,
    read_file_content,
    read_file_excerpt,
)
from .git_ops import GitError, git_diff, git_stage, git_status
from .patch_generator import generate_proposed_content_async
from .shell_ops import ShellError, run_shell_command
from .symbol_search import search_symbols
from .web_search_service import search_web

TOOL_NAMES = (
    "read_file",
    "write_file",
    "list_files",
    "search_symbols",
    "run_shell",
    "git_status",
    "git_diff",
    "git_stage",
    "web_search",
    "fetch_url",
    "spawn_subagent",
    "go_to_definition",
    "find_references",
    "get_diagnostics",
    "create_pull_request",
    "cowork_run",
)

WRITE_TOOLS = frozenset({"write_file", "git_stage", "create_pull_request"})
DESTRUCTIVE_SHELL_PATTERN = re.compile(r"(?i)\b(rm|sudo|push|pull|fetch)\b")


@dataclass
class ToolContext:
    session_id: str
    user_id: str
    project_path: str
    current_file: str | None = None
    plan_mode: bool = False
    permission_mode: str = "auto_safe"
    pending_approvals: list[dict[str, Any]] = field(default_factory=list)
    edited_files: list[str] = field(default_factory=list)


@dataclass
class ToolResult:
    tool: str
    status: str
    message: str
    data: dict[str, Any] = field(default_factory=dict)
    blocked: bool = False


def tool_definitions() -> list[dict[str, Any]]:
    return [
        {"name": "read_file", "description": "Read file content from workspace", "parameters": {"path": "string"}},
        {"name": "write_file", "description": "Create or update a file", "parameters": {"path": "string", "prompt": "string"}},
        {"name": "list_files", "description": "List workspace files", "parameters": {"limit": "integer"}},
        {"name": "search_symbols", "description": "Find symbols across repo", "parameters": {"query": "string"}},
        {"name": "run_shell", "description": "Run sandboxed shell command", "parameters": {"command": "string"}},
        {"name": "git_status", "description": "Git working tree status", "parameters": {}},
        {"name": "git_diff", "description": "Git diff for path or worktree", "parameters": {"path": "string?"}},
        {"name": "git_stage", "description": "Stage files for commit", "parameters": {"paths": "string[]", "all_files": "boolean"}},
        {"name": "web_search", "description": "Search the web for documentation", "parameters": {"query": "string"}},
        {"name": "fetch_url", "description": "Fetch URL content excerpt", "parameters": {"url": "string"}},
        {"name": "spawn_subagent", "description": "Spawn isolated subagent for subtask", "parameters": {"task": "string", "scope": "string?"}},
        {"name": "go_to_definition", "description": "LSP go-to-definition", "parameters": {"path": "string", "line": "int", "character": "int"}},
        {"name": "find_references", "description": "LSP find references", "parameters": {"path": "string", "line": "int", "character": "int"}},
        {"name": "get_diagnostics", "description": "LSP diagnostics for file", "parameters": {"path": "string"}},
        {"name": "create_pull_request", "description": "Create GitHub/GitLab PR/MR", "parameters": {"title": "string", "body": "string", "provider": "string"}},
        {"name": "cowork_run", "description": "Run autonomous CodeForge Cowork workflow from a natural-language goal", "parameters": {"goal": "string"}},
    ]


def _blocked_by_plan_mode(tool_name: str, ctx: ToolContext) -> bool:
    if not ctx.plan_mode:
        return False
    return tool_name in WRITE_TOOLS or tool_name == "run_shell"


def _needs_approval(tool_name: str, args: dict[str, Any], ctx: ToolContext) -> bool:
    if ctx.permission_mode != "ask":
        return False
    if tool_name in WRITE_TOOLS:
        return True
    if tool_name == "run_shell":
        command = str(args.get("command", ""))
        return bool(DESTRUCTIVE_SHELL_PATTERN.search(command))
    if tool_name in {"web_search", "fetch_url", "create_pull_request"}:
        return True
    return False


async def execute_tool(tool_name: str, args: dict[str, Any], ctx: ToolContext) -> ToolResult:
    if tool_name not in TOOL_NAMES:
        return ToolResult(tool=tool_name, status="error", message=f"Unknown tool: {tool_name}")

    if _blocked_by_plan_mode(tool_name, ctx):
        return ToolResult(
            tool=tool_name,
            status="blocked",
            message="Plan mode is enabled — writes and shell are blocked until plan is approved.",
            blocked=True,
        )

    if _needs_approval(tool_name, args, ctx):
        from .permission_service import record_permission_event

        record_permission_event(
            user_id=ctx.user_id,
            session_id=ctx.session_id,
            tool=tool_name,
            action="invoke",
            granted=False,
            note="awaiting user approval",
        )
        ctx.pending_approvals.append({"tool": tool_name, "args": args})
        return ToolResult(
            tool=tool_name,
            status="pending_approval",
            message=f"Permission mode 'ask' requires approval for {tool_name}.",
            blocked=True,
        )

    try:
        if tool_name == "read_file":
            path = str(args.get("path", ctx.current_file or "")).strip()
            if not path:
                return ToolResult(tool_name, "error", "path is required")
            content = read_file_content(ctx.project_path, path)
            excerpt = read_file_excerpt(ctx.project_path, path)
            return ToolResult(tool_name, "completed", f"Read {path}", {"path": path, "content": content, "excerpt": excerpt})

        if tool_name == "list_files":
            limit = int(args.get("limit", 200))
            files = list_workspace_files(ctx.project_path, max_files=limit)
            return ToolResult(tool_name, "completed", f"Listed {len(files)} files", {"files": files})

        if tool_name == "search_symbols":
            query = str(args.get("query", "")).strip()
            if not query:
                return ToolResult(tool_name, "error", "query is required")
            payload = search_symbols(ctx.project_path, query)
            return ToolResult(tool_name, "completed", f"Found {payload['match_count']} matches", payload)

        if tool_name == "run_shell":
            command = str(args.get("command", "")).strip()
            if not command:
                return ToolResult(tool_name, "error", "command is required")
            result = await run_shell_command(ctx.project_path, command, user_id=ctx.user_id)
            tool_result = ToolResult(
                tool_name,
                "completed" if result.get("passed") else "failed",
                str(result.get("summary", "")),
                result,
            )
            if not result.get("passed"):
                output = str(result.get("output", ""))
                error_hint = output.splitlines()[-1] if output else command
                try:
                    search_payload = await search_web(error_hint[:120], limit=3)
                    tool_result.data["error_search"] = search_payload
                    tool_result.message = f"{tool_result.message}\nWeb hints: {search_payload.get('result_count', 0)} result(s)"
                except Exception:
                    pass
            return tool_result

        if tool_name == "git_status":
            status = git_status(ctx.project_path)
            return ToolResult(tool_name, "completed", status.get("summary", "ok"), status)

        if tool_name == "git_diff":
            path = args.get("path")
            diff = git_diff(ctx.project_path, str(path) if path else None)
            return ToolResult(tool_name, "completed", diff.get("stat", "diff ready"), diff)

        if tool_name == "git_stage":
            paths = args.get("paths") or []
            all_files = bool(args.get("all_files"))
            staged = git_stage(ctx.project_path, list(paths) if paths else None, all_files=all_files)
            return ToolResult(tool_name, "completed", f"Staged {len(staged.get('paths', []))} path(s)", staged)

        if tool_name == "web_search":
            query = str(args.get("query", "")).strip()
            if not query:
                return ToolResult(tool_name, "error", "query is required")
            payload = await search_web(query, limit=int(args.get("limit", 5)))
            return ToolResult(tool_name, "completed", f"Found {payload['result_count']} results", payload)

        if tool_name == "fetch_url":
            url = str(args.get("url", "")).strip()
            if not url:
                return ToolResult(tool_name, "error", "url is required")
            from .scrape_service import scrape_url_excerpt

            excerpt = await scrape_url_excerpt(url)
            return ToolResult(tool_name, "completed", "Fetched URL excerpt", {"url": url, "excerpt": excerpt})

        if tool_name == "write_file":
            path = str(args.get("path", "")).strip()
            edit_prompt = str(args.get("prompt", "")).strip()
            if not path:
                path = infer_target_file(ctx.project_path, edit_prompt, current_file=ctx.current_file) or ""
            if not path:
                return ToolResult(tool_name, "error", "Could not infer target file")
            original = read_file_content(ctx.project_path, path)
            patch = await generate_proposed_content_async(path, edit_prompt, original)
            if not patch.changed:
                return ToolResult(tool_name, "unchanged", f"No changes for {path}", {"path": path})
            applied = apply_proposed_content(ctx.project_path, path, patch.proposed_content)
            if applied:
                ctx.edited_files.append(path)
            return ToolResult(
                tool_name,
                "completed" if applied else "error",
                f"{'Updated' if applied else 'Failed to update'} {path}",
                {"path": path, "applied": applied, "source": patch.source},
            )

        if tool_name in {"go_to_definition", "find_references", "get_diagnostics"}:
            from .lsp_service import lsp_tool_dispatch

            payload = await lsp_tool_dispatch(tool_name, args, ctx.project_path)
            return ToolResult(tool_name, "completed", payload.get("message", "ok"), payload)

        if tool_name == "spawn_subagent":
            from .subagent_service import spawn_subagent_task

            payload = await spawn_subagent_task(
                session_id=ctx.session_id,
                user_id=ctx.user_id,
                project_path=ctx.project_path,
                task=str(args.get("task", "")),
                scope=args.get("scope"),
            )
            return ToolResult(tool_name, "completed", payload.get("summary", "subagent done"), payload)

        if tool_name == "create_pull_request":
            from .pr_service import create_pull_request

            payload = await create_pull_request(
                project_path=ctx.project_path,
                title=str(args.get("title", "")),
                body=str(args.get("body", "")),
                provider=str(args.get("provider", "github")),
            )
            return ToolResult(tool_name, "completed", payload.get("message", "PR created"), payload)

        if tool_name == "cowork_run":
            from .cowork_orchestrator import run_goal_workflow

            goal = str(args.get("goal", "")).strip()
            if not goal:
                return ToolResult(tool_name, "error", "goal is required")
            payload = await run_goal_workflow(
                goal=goal,
                user_id=ctx.user_id,
                session_id=ctx.session_id,
                project_path=ctx.project_path,
                approved=ctx.permission_mode != "ask",
            )
            return ToolResult(
                tool_name,
                str(payload.get("status", "completed")),
                str(payload.get("summary", "Cowork workflow finished")),
                payload,
            )

        return ToolResult(tool_name, "error", "Tool not implemented")
    except (ShellError, GitError) as exc:
        return ToolResult(tool_name, "error", str(exc))
    except Exception as exc:
        return ToolResult(tool_name, "error", f"{type(exc).__name__}: {exc}")


def infer_tool_plan(prompt: str, current_file: str | None = None) -> list[dict[str, Any]]:
    lowered = prompt.lower()
    plan: list[dict[str, Any]] = []

    if any(k in lowered for k in ("git status", "what changed", "uncommitted")):
        plan.append({"tool": "git_status", "args": {}})
    if any(k in lowered for k in ("git diff", "show diff")):
        plan.append({"tool": "git_diff", "args": {"path": current_file} if current_file else {}})
    if any(k in lowered for k in ("pytest", "npm test", "run test", "run tests")):
        for token in prompt.split():
            if token in {"pytest", "npm", "cargo", "dotnet"}:
                plan.append({"tool": "run_shell", "args": {"command": " ".join(prompt.split()[:6])}})
                break
        if not any(item["tool"] == "run_shell" for item in plan):
            plan.append({"tool": "run_shell", "args": {"command": "pytest -q"}})
    if any(k in lowered for k in ("search web", "look up", "documentation", "how to", "syntax error", "import error")):
        plan.append({"tool": "web_search", "args": {"query": prompt[:160]}})
    if any(k in lowered for k in ("find symbol", "find references", "go to definition", "where is ")):
        query = prompt.split()[-1].strip("?.")
        plan.append({"tool": "search_symbols", "args": {"query": query}})
    if any(k in lowered for k in ("list files", "show files", "workspace files")):
        plan.append({"tool": "list_files", "args": {"limit": 100}})
    if current_file and any(k in lowered for k in ("read", "explain", "what does")):
        plan.append({"tool": "read_file", "args": {"path": current_file}})

    if not plan:
        plan.append({"tool": "write_file", "args": {"path": current_file or "", "prompt": prompt}})

    return plan[:8]


async def parse_tool_plan_with_llm(prompt: str, client: Any) -> list[dict[str, Any]] | None:
    system = (
        "Return ONLY JSON: {\"steps\":[{\"tool\":\"name\",\"args\":{}}]}. "
        f"Allowed tools: {', '.join(TOOL_NAMES)}. Max 6 steps."
    )
    response = await client.generate(
        prompt=f"User task: {prompt}\nChoose tools to accomplish this.",
        system_prompt=system,
        max_tokens=800,
    )
    text = str(response.get("text", "")).strip()
    if not text:
        return None
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    steps = payload.get("steps") or payload.get("tools") or []
    normalized: list[dict[str, Any]] = []
    for step in steps:
        if not isinstance(step, dict):
            continue
        tool = str(step.get("tool", "")).strip()
        if tool not in TOOL_NAMES:
            continue
        args = step.get("args") if isinstance(step.get("args"), dict) else {}
        normalized.append({"tool": tool, "args": args})
    return normalized or None

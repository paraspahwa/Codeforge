"""Claude Code–style extension catalog: LSP, workflow plugins, native surface, MCP."""

from __future__ import annotations

from typing import Any, Literal

ExtensionKind = Literal["lsp", "workflow", "native"]

EXTENSION_CATEGORIES: list[dict[str, str]] = [
    {"id": "lsp", "title": "Code Intelligence (LSP)", "emoji": "🔌"},
    {"id": "workflow", "title": "Task & Workflow Plugins", "emoji": "📦"},
    {"id": "native", "title": "Native Extension Surface", "emoji": "🛠️"},
]

LSP_PLUGINS: list[dict[str, Any]] = [
    {"id": "typescript-lsp", "name": "TypeScript / JS", "language": "TypeScript / JavaScript", "binary": "typescript-language-server", "package": "typescript-language-server", "install_hint": "npm i -g typescript-language-server typescript"},
    {"id": "pyright-lsp", "name": "Python", "language": "Python", "binary": "pyright-langserver", "package": "pyright", "install_hint": "npm i -g pyright", "binary_alternatives": ["pyright"]},
    {"id": "rust-analyzer-lsp", "name": "Rust", "language": "Rust", "binary": "rust-analyzer", "package": "rust-analyzer", "install_hint": "rustup component add rust-analyzer"},
    {"id": "gopls-lsp", "name": "Go", "language": "Go", "binary": "gopls", "package": "gopls", "install_hint": "go install golang.org/x/tools/gopls@latest"},
    {"id": "clangd-lsp", "name": "C / C++", "language": "C / C++", "binary": "clangd", "package": "clangd", "install_hint": "apt/brew install clangd or LLVM"},
    {"id": "csharp-lsp", "name": "C#", "language": "C#", "binary": "csharp-ls", "package": "csharp-ls", "install_hint": "dotnet tool install -g csharp-ls"},
    {"id": "jdtls-lsp", "name": "Java", "language": "Java", "binary": "jdtls", "package": "jdtls", "install_hint": "Install Eclipse JDT Language Server"},
    {"id": "kotlin-lsp", "name": "Kotlin", "language": "Kotlin", "binary": "kotlin-language-server", "package": "kotlin-language-server", "install_hint": "brew install kotlin-language-server"},
    {"id": "lua-lsp", "name": "Lua", "language": "Lua", "binary": "lua-language-server", "package": "lua-language-server", "install_hint": "Download from LuaLS releases"},
    {"id": "php-lsp", "name": "PHP", "language": "PHP", "binary": "intelephense", "package": "intelephense", "install_hint": "npm i -g intelephense"},
    {"id": "swift-lsp", "name": "Swift", "language": "Swift", "binary": "sourcekit-lsp", "package": "sourcekit-lsp", "install_hint": "Included with Swift toolchain (xcode-select)"},
]

WORKFLOW_PLUGINS: list[dict[str, Any]] = [
    {
        "id": "commit-commands",
        "name": "commit-commands",
        "description": "Streamlines Git — tracks changes, generates commit messages, stages, and opens pull requests.",
        "skills": ["pr-conventions"],
        "template_name": "Git commit workflow",
        "template_prefix": "You are a Git workflow assistant. Review staged/unstaged changes, draft a semantic commit message, stage files, and prepare a pull request when asked.",
        "verify_command": "git status --short",
    },
    {
        "id": "pr-review-toolkit",
        "name": "pr-review-toolkit",
        "description": "Spins up isolated code reviewers for PRs — tests, performance, and quality audits.",
        "skills": ["webapp-testing", "pr-conventions"],
        "template_name": "PR review toolkit",
        "template_prefix": "You are a pull-request reviewer. Analyze diffs for bugs, performance issues, missing tests, and style violations. Summarize findings by severity.",
        "verify_command": None,
    },
    {
        "id": "plugin-dev",
        "name": "plugin-dev",
        "description": "Sandbox toolkit for building custom Claude Code plugins — templates, verification, and authoring commands.",
        "skills": ["skill-creator", "mcp-builder"],
        "template_name": "Plugin developer",
        "template_prefix": "You help author CodeForge extensions: SKILL.md files, MCP connectors, hooks.json, and agent templates. Follow project conventions.",
        "verify_command": None,
    },
    {
        "id": "agent-sdk-dev",
        "name": "agent-sdk-dev",
        "description": "Tools and boilerplates for building custom agentic systems with the Claude Agent SDK.",
        "skills": ["mcp-builder", "doc-coauthoring"],
        "template_name": "Agent SDK developer",
        "template_prefix": "You assist developers building agentic systems — tool design, orchestration patterns, streaming, and SDK integration.",
        "verify_command": None,
    },
    {
        "id": "internet-research",
        "name": "internet-research",
        "description": "Internet research — web pages, YouTube transcripts, RSS, and GitHub via Agent Reach server tools; social platforms via local CLI.",
        "skills": ["agent-reach"],
        "template_name": "Internet research",
        "template_prefix": "You research the open web and public sources. Prefer agent_reach MCP tools (fetch_web, youtube_transcript, rss_read, github_repo) for URLs. Summarize findings with citations. For Twitter/Reddit/XHS, instruct the user to enable local Agent Reach if server tools are insufficient.",
        "verify_command": None,
    },
]

NATIVE_EXTENSIONS: list[dict[str, Any]] = [
    {
        "id": "claude-md",
        "name": "CLAUDE.md & Rules",
        "description": "Persistent project memory — architectural mandates, style guides, and explicit commands.",
        "config_path": "CLAUDE.md",
        "alt_paths": ["CODEFORGE.md", ".codeforge/AGENTS.md"],
        "setup_note": "Add CLAUDE.md to your repo root. CodeForge injects it into every agent turn.",
    },
    {
        "id": "skills",
        "name": "Skills (SKILL.md)",
        "description": "On-demand prompt extensions — slash-commands and repeatable macros for domain expertise.",
        "config_path": ".codeforge/skills/<name>/SKILL.md",
        "setup_note": "Author skills under .codeforge/skills/ or use bundled skills from Settings.",
    },
    {
        "id": "hooks",
        "name": "Event-Driven Hooks",
        "description": "Scripts that fire on SessionStart, PreToolUse, PostToolUse, FileChanged, and PermissionDenied.",
        "config_path": ".codeforge/hooks.json",
        "setup_note": "Configure command, http, mcp_tool, prompt, or agent hook types in hooks.json.",
    },
]

HOOK_EVENTS = [
    "SessionStart",
    "SessionEnd",
    "PreToolUse",
    "PostToolUse",
    "FileChanged",
    "PermissionDenied",
]

HOOK_TYPES = ["command", "http", "mcp_tool", "prompt", "agent"]


def _lsp_as_extension(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "kind": "lsp",
        "category": "lsp",
        "name": row["name"],
        "description": f"LSP code intelligence for {row['language']}.",
        "language": row["language"],
        "binary": row["binary"],
        "package": row.get("package"),
        "install_hint": row.get("install_hint", ""),
        "binary_alternatives": row.get("binary_alternatives", []),
    }


def _workflow_as_extension(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "kind": "workflow",
        "category": "workflow",
        "name": row["name"],
        "description": row["description"],
        "skills": row.get("skills", []),
        "template_name": row.get("template_name"),
    }


def _native_as_extension(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "kind": "native",
        "category": "native",
        "name": row["name"],
        "description": row["description"],
        "config_path": row.get("config_path"),
        "setup_note": row.get("setup_note", ""),
    }


def list_extension_categories() -> list[dict[str, str]]:
    return list(EXTENSION_CATEGORIES)


def list_extensions(*, category: str | None = None) -> list[dict[str, Any]]:
    from .catalog_versions import catalog_version_for

    items: list[dict[str, Any]] = []
    for row in LSP_PLUGINS:
        item = _lsp_as_extension(row)
        item["version"] = catalog_version_for(row)
        items.append(item)
    for row in WORKFLOW_PLUGINS:
        item = _workflow_as_extension(row)
        item["version"] = catalog_version_for(row)
        items.append(item)
    for row in NATIVE_EXTENSIONS:
        item = _native_as_extension(row)
        item["version"] = catalog_version_for(row)
        items.append(item)
    if category:
        return [item for item in items if item["category"] == category]
    return items


def get_extension(extension_id: str) -> dict[str, Any] | None:
    for item in list_extensions():
        if item["id"] == extension_id:
            return item
    return None


def get_lsp_plugin(plugin_id: str) -> dict[str, Any] | None:
    for row in LSP_PLUGINS:
        if row["id"] == plugin_id:
            return row
    return None


def get_workflow_plugin(plugin_id: str) -> dict[str, Any] | None:
    for row in WORKFLOW_PLUGINS:
        if row["id"] == plugin_id:
            return row
    return None

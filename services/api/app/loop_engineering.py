from __future__ import annotations

from dataclasses import dataclass, field
from fnmatch import fnmatch
from pathlib import Path, PurePosixPath
from typing import Any

from .git_ops import git_status

CONFIG_REL = Path(".codeforge") / "loop-engineering.yaml"

_DEFAULT_CONFIG: dict[str, Any] = {
    "version": 1,
    "loop": {"max_attempts": 5, "auto_heal": True, "autonomous": True, "pause_on_limit": True},
    "pipelines": [
        {
            "id": "api-python",
            "globs": ["services/api/**"],
            "commands": [{"id": "pytest", "command": "npm run api:test", "cwd": ".", "required": True}],
        },
        {
            "id": "web-next",
            "globs": ["apps/web/**", "packages/ui/**", "packages/shared/**", "packages/design-tokens/**"],
            "commands": [
                {"id": "lint", "command": "npm run lint:web", "cwd": ".", "required": True},
                {"id": "build", "command": "npm run build:web", "cwd": ".", "required": True},
            ],
        },
        {
            "id": "vscode-ext",
            "globs": ["apps/vscode/**"],
            "commands": [{"id": "syntax-check", "command": "npm run check:vscode", "cwd": ".", "required": True}],
        },
        {
            "id": "desktop-tauri",
            "globs": ["apps/desktop/**"],
            "commands": [{"id": "cargo-check", "command": "cargo check", "cwd": "apps/desktop/src-tauri", "required": True}],
        },
        {
            "id": "e2e-playwright",
            "globs": ["e2e/**", "playwright.config.*"],
            "commands": [{"id": "e2e", "command": "npm run test:e2e", "cwd": ".", "required": True}],
        },
    ],
    "default": {
        "commands": [{"id": "api-test", "command": "npm run api:test", "cwd": ".", "required": True}],
    },
}


class LoopEngineeringError(ValueError):
    pass


@dataclass(frozen=True)
class VerifyCommand:
    id: str
    command: str
    cwd: str = "."
    required: bool = True
    pipeline_id: str | None = None
    note: str | None = None


@dataclass
class LoopResolveResult:
    changed_paths: list[str] = field(default_factory=list)
    matched_pipeline_ids: list[str] = field(default_factory=list)
    commands: list[VerifyCommand] = field(default_factory=list)
    max_attempts: int = 5
    config_source: str = "default"

    @property
    def verify_command(self) -> str:
        """Human-readable summary for UIs that still show a single verify string."""
        required = [item.command for item in self.commands if item.required]
        if not required:
            return ""
        if len(required) == 1:
            return required[0]
        return " → ".join(required)

    def to_dict(self) -> dict[str, Any]:
        return {
            "changed_paths": self.changed_paths,
            "matched_pipeline_ids": self.matched_pipeline_ids,
            "commands": [
                {
                    "id": item.id,
                    "command": item.command,
                    "cwd": item.cwd,
                    "required": item.required,
                    "pipeline_id": item.pipeline_id,
                    "note": item.note,
                }
                for item in self.commands
            ],
            "verify_command": self.verify_command,
            "max_attempts": self.max_attempts,
            "config_source": self.config_source,
        }


def _load_yaml_text(path: Path) -> dict[str, Any]:
    try:
        import yaml
    except ImportError as exc:
        raise LoopEngineeringError(
            "PyYAML is required to load .codeforge/loop-engineering.yaml"
        ) from exc

    try:
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise LoopEngineeringError(f"Could not read loop config: {path}") from exc
    except yaml.YAMLError as exc:
        raise LoopEngineeringError(f"Invalid loop-engineering YAML: {exc}") from exc

    if not isinstance(payload, dict):
        raise LoopEngineeringError("loop-engineering config must be a YAML mapping")
    return payload


def load_loop_config(project_path: str) -> tuple[dict[str, Any], str]:
    root = Path(project_path).expanduser().resolve()
    config_path = root / CONFIG_REL
    if config_path.is_file():
        return _load_yaml_text(config_path), str(config_path)
    return _DEFAULT_CONFIG, "builtin-default"


def _normalize_path(path: str) -> str:
    return path.replace("\\", "/").lstrip("./")


def _glob_matches(path: str, pattern: str) -> bool:
    normalized = _normalize_path(path)
    normalized_pattern = pattern.replace("\\", "/")
    try:
        if PurePosixPath(normalized).match(normalized_pattern):
            return True
    except ValueError:
        pass
    return fnmatch(normalized, normalized_pattern)


def _pipeline_for_path(path: str, pipelines: list[dict[str, Any]]) -> dict[str, Any] | None:
    for pipeline in pipelines:
        for glob_pattern in pipeline.get("globs", []):
            if _glob_matches(path, str(glob_pattern)):
                return pipeline
    return None


def _parse_command(raw: dict[str, Any], *, pipeline_id: str) -> VerifyCommand | None:
    command = str(raw.get("command") or "").strip()
    if not command:
        return None
    return VerifyCommand(
        id=str(raw.get("id") or command),
        command=command,
        cwd=str(raw.get("cwd") or ".").strip() or ".",
        required=bool(raw.get("required", True)),
        pipeline_id=pipeline_id,
        note=str(raw.get("note")).strip() if raw.get("note") else None,
    )


def collect_changed_paths(project_path: str, explicit_paths: list[str] | None = None) -> list[str]:
    if explicit_paths:
        seen: set[str] = set()
        ordered: list[str] = []
        for path in explicit_paths:
            normalized = _normalize_path(path)
            if normalized and normalized not in seen:
                seen.add(normalized)
                ordered.append(normalized)
        return ordered

    status = git_status(project_path)
    paths: list[str] = []
    seen: set[str] = set()
    for item in status.get("changed_files", []):
        normalized = _normalize_path(str(item.get("path") or ""))
        if normalized and normalized not in seen:
            seen.add(normalized)
            paths.append(normalized)
    for path in status.get("untracked_files", []):
        normalized = _normalize_path(str(path))
        if normalized and normalized not in seen:
            seen.add(normalized)
            paths.append(normalized)
    return paths


def resolve_verify_plan(
    project_path: str,
    *,
    changed_paths: list[str] | None = None,
) -> LoopResolveResult:
    config, source = load_loop_config(project_path)
    paths = collect_changed_paths(project_path, changed_paths)
    pipelines = list(config.get("pipelines") or [])
    default_block = config.get("default") or {}
    max_attempts = int((config.get("loop") or {}).get("max_attempts") or 5)

    pipeline_ids: list[str] = []
    commands_by_key: dict[tuple[str, str, str], VerifyCommand] = {}

    def add_commands(pipeline: dict[str, Any]) -> None:
        pipeline_id = str(pipeline.get("id") or "unknown")
        if pipeline_id not in pipeline_ids:
            pipeline_ids.append(pipeline_id)
        for raw in pipeline.get("commands") or []:
            if not isinstance(raw, dict):
                continue
            parsed = _parse_command(raw, pipeline_id=pipeline_id)
            if not parsed:
                continue
            key = (parsed.id, parsed.command, parsed.cwd)
            commands_by_key[key] = parsed

    if paths:
        for path in paths:
            pipeline = _pipeline_for_path(path, pipelines)
            if pipeline:
                add_commands(pipeline)
    else:
        for raw in default_block.get("commands") or []:
            if isinstance(raw, dict):
                parsed = _parse_command(raw, pipeline_id="default")
                if parsed:
                    key = (parsed.id, parsed.command, parsed.cwd)
                    commands_by_key[key] = parsed

    if not commands_by_key:
        fallback = {"id": "default", "commands": default_block.get("commands") or []}
        add_commands(fallback)
        if "default" not in pipeline_ids:
            pipeline_ids.append("default")

    ordered_commands = list(commands_by_key.values())
    required_first = [item for item in ordered_commands if item.required]
    optional = [item for item in ordered_commands if not item.required]
    final_commands = required_first + optional

    return LoopResolveResult(
        changed_paths=paths,
        matched_pipeline_ids=pipeline_ids,
        commands=final_commands,
        max_attempts=max(1, min(max_attempts, 10)),
        config_source=source,
    )


def resolve_verify_command(project_path: str, *, changed_paths: list[str] | None = None) -> str:
    return resolve_verify_plan(project_path, changed_paths=changed_paths).verify_command

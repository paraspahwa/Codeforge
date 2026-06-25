from __future__ import annotations

from pathlib import Path

import pytest

from app.loop_engineering import collect_changed_paths, resolve_verify_plan


def _write_config(project: Path) -> None:
    config_dir = project / ".codeforge"
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / "loop-engineering.yaml").write_text(
        """
version: 1
loop:
  max_attempts: 5
pipelines:
  - id: api-python
    globs:
      - "services/api/**"
    commands:
      - id: pytest
        command: "npm run api:test"
        cwd: "."
        required: true
  - id: web-next
    globs:
      - "apps/web/**"
    commands:
      - id: lint
        command: "npm run lint:web"
        cwd: "."
        required: true
default:
  commands:
    - id: api-test
      command: "npm run api:test"
      cwd: "."
      required: true
""".strip(),
        encoding="utf-8",
    )


def test_resolve_api_pipeline(tmp_path: Path) -> None:
    project = tmp_path / "repo"
    project.mkdir()
    _write_config(project)

    plan = resolve_verify_plan(str(project), changed_paths=["services/api/app/main.py"])

    assert "api-python" in plan.matched_pipeline_ids
    assert plan.verify_command == "npm run api:test"
    assert plan.commands[0].command == "npm run api:test"


def test_resolve_multiple_pipelines_dedupes_commands(tmp_path: Path) -> None:
    project = tmp_path / "repo"
    project.mkdir()
    _write_config(project)

    plan = resolve_verify_plan(
        str(project),
        changed_paths=["services/api/app/main.py", "apps/web/app/page.jsx"],
    )

    assert "api-python" in plan.matched_pipeline_ids
    assert "web-next" in plan.matched_pipeline_ids
    commands = [item.command for item in plan.commands if item.required]
    assert commands == ["npm run api:test", "npm run lint:web"]
    assert plan.verify_command == "npm run api:test → npm run lint:web"


def test_resolve_default_when_no_changed_paths(tmp_path: Path) -> None:
    project = tmp_path / "repo"
    project.mkdir()
    _write_config(project)

    plan = resolve_verify_plan(str(project), changed_paths=[])

    assert plan.matched_pipeline_ids == ["default"]
    assert plan.verify_command == "npm run api:test"


def test_collect_changed_paths_explicit() -> None:
    paths = collect_changed_paths("/tmp", explicit_paths=["./apps/web/a.js", "apps/web/a.js"])
    assert paths == ["apps/web/a.js"]

from __future__ import annotations

from pathlib import Path

import pytest

from app.agent_loop import run_verify_fix_loop
from app.db import init_db, insert_session


@pytest.mark.asyncio
async def test_agent_loop_passes_when_verify_succeeds(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    project = tmp_path / "repo"
    project.mkdir()
    (project / "README.md").write_text("# demo\n", encoding="utf-8")

    init_db()
    session_id = "sess_loop_pass"
    insert_session(
        session_id=session_id,
        user_id="loop-user",
        project_path=str(project),
        model_preference="auto",
        created_at="2026-06-01T00:00:00+00:00",
    )

    async def fake_verify(_project_path: str, _command: str, timeout_seconds: int = 30, **kwargs):
        _ = timeout_seconds, kwargs
        return {
            "command": _command,
            "cwd": str(project),
            "exit_code": 0,
            "passed": True,
            "summary": "ok",
            "output": "ok",
            "timed_out": False,
        }

    monkeypatch.setattr("app.agent_loop.run_shell_command", fake_verify)

    result = await run_verify_fix_loop(
        session_id=session_id,
        user_id="loop-user",
        project_path=str(project),
        verify_command="echo ok",
        max_attempts=2,
    )

    assert result.passed is True
    assert result.attempts == []


@pytest.mark.asyncio
async def test_agent_loop_applies_patch_when_verify_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    project = tmp_path / "repo"
    project.mkdir()
    target = project / "app.py"
    target.write_text("def run():\n    pass\n", encoding="utf-8")

    init_db()
    session_id = "sess_loop_fix"
    insert_session(
        session_id=session_id,
        user_id="loop-user-2",
        project_path=str(project),
        model_preference="auto",
        created_at="2026-06-01T00:00:00+00:00",
    )

    calls = {"count": 0}

    async def fake_verify(_project_path: str, _command: str, timeout_seconds: int = 30, **kwargs):
        _ = timeout_seconds, kwargs
        calls["count"] += 1
        passed = calls["count"] > 1
        return {
            "command": _command,
            "cwd": str(project),
            "exit_code": 0 if passed else 1,
            "passed": passed,
            "summary": "ok" if passed else "failed",
            "output": "ok" if passed else "failed",
            "timed_out": False,
        }

    monkeypatch.setattr("app.agent_loop.run_shell_command", fake_verify)

    result = await run_verify_fix_loop(
        session_id=session_id,
        user_id="loop-user-2",
        project_path=str(project),
        verify_command="echo test",
        fix_prompt="add unit test",
        max_attempts=3,
        auto_apply=True,
        current_file="app.py",
    )

    assert result.passed is True
    assert len(result.attempts) >= 1
    assert any(attempt.applied for attempt in result.attempts)
    assert "test_codeforge_generated" in target.read_text(encoding="utf-8")

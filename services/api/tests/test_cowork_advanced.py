from __future__ import annotations

from pathlib import Path

import pytest

from app.cowork_file_ops import execute_file_operations, preview_organize_by_date
from app.cowork_planner import plan_from_goal
from app.cowork_synthesis import synthesize_markdown_report


@pytest.fixture()
def workspace(tmp_path: Path) -> str:
    (tmp_path / "notes").mkdir()
    (tmp_path / "notes" / "alpha.txt").write_text("hello alpha", encoding="utf-8")
    (tmp_path / "notes" / "beta.txt").write_text("hello beta", encoding="utf-8")
    return tmp_path.as_posix()


def test_plan_from_goal_organize_and_synthesize(workspace: str) -> None:
    workflow = plan_from_goal(
        "Organize files in notes by date and synthesize a summary report",
        project_path=workspace,
        session_id="sess_test",
    )
    assert workflow["step_count"] >= 2
    task_types = {step["task_type"] for step in workflow["steps"]}
    assert "file_ops" in task_types
    assert "synthesize" in task_types


def test_preview_organize_by_date(workspace: str) -> None:
    preview = preview_organize_by_date(workspace, "notes")
    assert preview["move_count"] >= 0


def test_synthesize_markdown_report(workspace: str) -> None:
    result = synthesize_markdown_report(
        project_path=workspace,
        source_path="notes",
        output_name="test-report.md",
        title="Test Report",
        prompt="Summarize notes",
    )
    assert result["status"] == "completed"
    output = Path(workspace) / result["output_path"]
    assert output.is_file()
    assert "Test Report" in output.read_text(encoding="utf-8")


def test_execute_file_operations_mkdir(workspace: str) -> None:
    result = execute_file_operations(
        workspace,
        [{"action": "mkdir", "path": "organized/new-folder"}],
    )
    assert result["status"] == "completed"
    assert (Path(workspace) / "organized/new-folder").is_dir()

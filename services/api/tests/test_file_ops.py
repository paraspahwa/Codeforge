from __future__ import annotations

from pathlib import Path

import pytest

from app.file_ops import (
    FileOpsError,
    apply_proposed_content,
    infer_target_file,
    read_file_content,
    resolve_project_root,
    resolve_repo_path,
)


def test_resolve_project_root_rejects_missing_path(tmp_path: Path) -> None:
    missing = tmp_path / "missing"
    with pytest.raises(FileOpsError, match="does not exist"):
        resolve_project_root(str(missing))


def test_resolve_repo_path_blocks_traversal(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()
    (project / "README.md").write_text("# hello\n", encoding="utf-8")

    resolved = resolve_repo_path(str(project), "../outside.txt")
    assert resolved is None


def test_read_and_apply_file_within_project(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()
    target = project / "notes.txt"
    target.write_text("original\n", encoding="utf-8")

    assert read_file_content(str(project), "notes.txt") == "original\n"
    assert apply_proposed_content(str(project), "notes.txt", "updated\n") is True
    assert read_file_content(str(project), "notes.txt") == "updated\n"


def test_apply_proposed_content_can_create_new_file(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()

    assert apply_proposed_content(str(project), "src/new.py", "print('ok')\n") is True
    assert read_file_content(str(project), "src/new.py") == "print('ok')\n"


def test_infer_target_file_uses_current_file(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()
    (project / "app.py").write_text("print('app')\n", encoding="utf-8")

    assert infer_target_file(str(project), "update billing", current_file="app.py") == "app.py"


def test_infer_target_file_finds_readme_keyword(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()
    (project / "README.md").write_text("# docs\n", encoding="utf-8")

    assert infer_target_file(str(project), "update the readme intro") == "README.md"

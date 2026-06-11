from __future__ import annotations

import sys
from pathlib import Path

import pytest

from app.shell_ops import ShellError, prepare_shell_execution


def test_shell_blocks_destructive_commands(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()

    with pytest.raises(ShellError, match="blocked"):
        prepare_shell_execution(str(project), "rm -rf .")


def test_shell_blocks_chained_commands(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()

    with pytest.raises(ShellError, match="blocked shell operators"):
        prepare_shell_execution(str(project), "echo hi && rm file.txt")


@pytest.mark.skipif(sys.platform != "win32", reason="Shell execution runtime expects PowerShell")
def test_shell_allows_safe_echo(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()

    root, sanitized, executable, rtk_applied = prepare_shell_execution(str(project), "echo hello")
    assert root == project.resolve()
    assert sanitized == "echo hello"
    assert executable
    assert rtk_applied is False

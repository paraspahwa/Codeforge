from __future__ import annotations

from pathlib import Path

from app.project_paths import normalize_project_path, resolved_project_path


def test_normalize_project_path_maps_host_prefix_to_container(tmp_path: Path, monkeypatch) -> None:
    host_root = tmp_path / "host"
    project = host_root / "demo"
    project.mkdir(parents=True)
    (project / "README.md").write_text("# demo\n", encoding="utf-8")

    monkeypatch.setenv("CODEFORGE_WORKSPACES_HOST_PREFIX", str(host_root))
    monkeypatch.setenv("CODEFORGE_WORKSPACES_CONTAINER_PREFIX", "/workspaces")

    mapped = normalize_project_path(str(project))
    assert mapped.replace("\\", "/") == "/workspaces/demo"


def test_resolved_project_path_reads_session_dict(tmp_path: Path, monkeypatch) -> None:
    project = tmp_path / "repo"
    project.mkdir()
    monkeypatch.delenv("CODEFORGE_WORKSPACES_HOST_PREFIX", raising=False)

    session = {"project_path": str(project)}
    assert Path(resolved_project_path(session)).resolve() == project.resolve()

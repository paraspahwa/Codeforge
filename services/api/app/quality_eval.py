from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .evals.swe_fixtures.tasks import load_swe_fixture_tasks
from .file_ops import apply_proposed_content


def _run_verify(project_root: Path, command: str, timeout_seconds: int = 45) -> tuple[int, str]:
    completed = subprocess.run(
        command,
        shell=True,
        cwd=project_root,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )
    output = "\n".join(part for part in (completed.stdout, completed.stderr) if part).strip()
    return completed.returncode, output[:2000]


def _materialize_task(task: dict[str, Any], root: Path) -> None:
    for relative_path, content in task.get("files", {}).items():
        destination = root / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(str(content), encoding="utf-8")


def run_quality_eval(suite: str = "swe-fixtures") -> dict[str, Any]:
    tasks = load_swe_fixture_tasks(suite)
    results: list[dict[str, Any]] = []
    passed_cases = 0

    for task in tasks:
        with tempfile.TemporaryDirectory(prefix="codeforge-swe-") as tmp_dir:
            root = Path(tmp_dir)
            _materialize_task(task, root)

            target_file = str(task["target_file"])
            proposed_content = str(task["proposed_content"])
            verify_command = str(task["verify_command"])

            applied = apply_proposed_content(str(root), target_file, proposed_content)
            verify_exit_code = 1
            verify_output = ""
            if applied:
                verify_exit_code, verify_output = _run_verify(root, verify_command)

            passed = applied and verify_exit_code == 0
            if passed:
                passed_cases += 1

            summary_parts = []
            if not applied:
                summary_parts.append("patch apply failed")
            if verify_exit_code != 0:
                summary_parts.append(f"verify exit {verify_exit_code}")
            if verify_output:
                summary_parts.append(verify_output.splitlines()[-1] if verify_output else "")

            results.append(
                {
                    "task_id": task["task_id"],
                    "description": task.get("description", ""),
                    "target_file": target_file,
                    "patch_applied": applied,
                    "verify_command": verify_command,
                    "verify_exit_code": verify_exit_code,
                    "passed": passed,
                    "summary": "; ".join(part for part in summary_parts if part) or "ok",
                }
            )

    total_cases = len(tasks)
    pass_rate = (passed_cases / total_cases) if total_cases else 0.0
    return {
        "suite": suite,
        "total_cases": total_cases,
        "passed_cases": passed_cases,
        "pass_rate": pass_rate,
        "fallback_usage_rate": 0.0,
        "low_confidence_rate": 0.0,
        "total_estimated_cost_usd": 0.0,
        "results": results,
    }

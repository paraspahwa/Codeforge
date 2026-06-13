from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any


class GitError(RuntimeError):
    pass


def _repo_root(project_path: str) -> Path:
    root = Path(project_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise GitError("Project path does not exist")
    return root


def _run_git(project_path: str, *args: str) -> str:
    root = _repo_root(project_path)

    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except FileNotFoundError as exc:
        raise GitError("git is not installed") from exc
    except subprocess.TimeoutExpired as exc:
        raise GitError("git command timed out") from exc

    if result.returncode != 0:
        error_text = (result.stderr or result.stdout or "git command failed").strip()
        raise GitError(error_text)

    return (result.stdout or "").strip()


def _normalize_paths(project_path: str, paths: list[str]) -> list[str]:
    root = _repo_root(project_path)
    normalized: list[str] = []

    for candidate in paths:
        if not candidate:
            continue

        path = Path(candidate)
        if path.is_absolute():
            raise GitError("Only repo-relative paths are allowed")

        safe_path = (root / path).resolve()
        try:
            safe_path.relative_to(root)
        except ValueError as exc:
            raise GitError("Path escapes the repository") from exc

        normalized.append(path.as_posix())

    if not normalized:
        raise GitError("No valid paths were provided")

    return normalized


def git_status(project_path: str) -> dict[str, Any]:
    output = _run_git(project_path, "status", "--short", "--branch")
    lines = [line for line in output.splitlines() if line.strip()]
    branch = lines[0].removeprefix("## ") if lines else "unknown"
    changed = []
    untracked = []

    for line in lines[1:]:
        status = line[:2].strip()
        file_path = line[3:].strip()
        if status == "??":
            untracked.append(file_path)
        else:
            changed.append({"status": status, "path": file_path})

    return {
        "branch": branch,
        "clean": not changed and not untracked,
        "changed_files": changed,
        "untracked_files": untracked,
        "summary": f"{len(changed)} changed, {len(untracked)} untracked",
    }


def git_diff(project_path: str, file_path: str | None = None) -> dict[str, Any]:
    args = ["diff", "--stat"]
    if file_path:
        args.extend(["--", file_path])
    stat_output = _run_git(project_path, *args)

    diff_args = ["diff"]
    if file_path:
        diff_args.extend(["--", file_path])
    diff_output = _run_git(project_path, *diff_args)

    return {
        "path": file_path,
        "stat": stat_output,
        "diff": diff_output,
    }


def git_log(project_path: str, limit: int = 10) -> dict[str, Any]:
    output = _run_git(project_path, "log", f"--max-count={limit}", "--oneline")
    commits = []
    for line in output.splitlines():
        if not line.strip():
            continue
        commit_id, _, message = line.partition(" ")
        commits.append({"commit_id": commit_id, "message": message.strip()})
    return {"commits": commits}


def git_stage(project_path: str, paths: list[str] | None = None, all_files: bool = False) -> dict[str, Any]:
    if all_files:
        output = _run_git(project_path, "add", "--all")
        return {"staged": True, "paths": ["."], "output": output}

    normalized_paths = _normalize_paths(project_path, paths or [])
    output = _run_git(project_path, "add", "--", *normalized_paths)
    return {"staged": True, "paths": normalized_paths, "output": output}


def git_commit(project_path: str, message: str) -> dict[str, Any]:
    commit_message = " ".join(message.strip().split())
    if not commit_message:
        raise GitError("Commit message cannot be empty")

    unmerged_output = _run_git(project_path, "diff", "--name-only", "--diff-filter=U")
    unmerged_files = [line.strip() for line in unmerged_output.splitlines() if line.strip()]
    if unmerged_files:
        preview = ", ".join(unmerged_files[:5])
        raise GitError(f"Resolve merge conflicts before committing: {preview}")

    staged_output = _run_git(project_path, "diff", "--cached", "--name-only")
    staged_files = [line.strip() for line in staged_output.splitlines() if line.strip()]
    if not staged_files:
        raise GitError("No staged changes to commit. Use /git stage first.")

    status_before = git_status(project_path)
    if status_before["clean"]:
        raise GitError("Nothing to commit")

    output = _run_git(project_path, "commit", "-m", commit_message)
    return {"committed": True, "message": commit_message, "staged_files": staged_files, "output": output}


def _safe_branch_name(branch: str) -> str:
    normalized = branch.strip()
    if not normalized:
        raise GitError("Branch name cannot be empty")

    if normalized.startswith("-") or ".." in normalized or " " in normalized:
        raise GitError("Branch name is not allowed")

    if any(part in normalized for part in {"~", "^", ":", "?", "*", "[", "\\"}):
        raise GitError("Branch name is not allowed")

    return normalized


def git_branch(project_path: str, branch: str, create: bool = True) -> dict[str, Any]:
    safe_branch = _safe_branch_name(branch)
    if create:
        output = _run_git(project_path, "checkout", "-b", safe_branch)
    else:
        output = _run_git(project_path, "checkout", safe_branch)

    return {"branch": safe_branch, "created": create, "output": output}


def _worktree_slug(branch: str) -> str:
    safe = branch.strip().replace("/", "_").replace("\\", "_")
    safe = "".join(ch if ch.isalnum() or ch in {"-", "_", "."} else "_" for ch in safe)
    return safe or "worktree"


def git_worktree_list(project_path: str) -> dict[str, Any]:
    output = _run_git(project_path, "worktree", "list", "--porcelain")
    worktrees: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for line in output.splitlines():
        if not line.strip():
            continue
        if line.startswith("worktree "):
            if current:
                worktrees.append(current)
            current = {"path": line[len("worktree "):].strip(), "branch": None, "locked": False, "prunable": False}
            continue
        if current is None:
            continue
        if line.startswith("branch "):
            current["branch"] = line[len("branch "):].replace("refs/heads/", "").strip()
            continue
        if line.startswith("locked"):
            current["locked"] = True
            continue
        if line.startswith("prunable"):
            current["prunable"] = True

    if current:
        worktrees.append(current)

    return {"worktrees": worktrees}


def git_worktree_create(project_path: str, branch: str) -> dict[str, Any]:
    safe_branch = _safe_branch_name(branch)
    root = _repo_root(project_path)
    worktree_path = root / ".codeforge" / "worktrees" / _worktree_slug(safe_branch)
    worktree_path.parent.mkdir(parents=True, exist_ok=True)

    output = _run_git(project_path, "worktree", "add", str(worktree_path), "-b", safe_branch)
    return {"branch": safe_branch, "path": worktree_path.as_posix(), "created": True, "output": output}


def git_merge_assist(project_path: str, target_branch: str) -> dict[str, Any]:
    safe_target = _safe_branch_name(target_branch)
    current_branch = _run_git(project_path, "branch", "--show-current") or "HEAD"

    base = _run_git(project_path, "merge-base", current_branch, safe_target)
    ahead_behind = _run_git(project_path, "rev-list", "--left-right", "--count", f"{current_branch}...{safe_target}")
    stat = _run_git(project_path, "diff", "--stat", f"{current_branch}...{safe_target}")
    changed_files_output = _run_git(project_path, "diff", "--name-only", f"{current_branch}...{safe_target}")
    merge_preview = _run_git(project_path, "merge-tree", base, current_branch, safe_target)

    conflict_lines = [line for line in merge_preview.splitlines() if line.startswith("<<<<<<<") or line.startswith("=======") or line.startswith(">>>>>>>")]
    changed_files = [line.strip() for line in changed_files_output.splitlines() if line.strip()]
    conflict_files = changed_files[:8] if conflict_lines else []

    ours_ahead = 0
    ours_behind = 0
    try:
        left, right = ahead_behind.split()
        ours_ahead = int(left)
        ours_behind = int(right)
    except Exception:
        ours_ahead = 0
        ours_behind = 0

    risk_level = "low"
    if conflict_lines:
        risk_level = "high"
    elif len(changed_files) >= 25 or ours_behind >= 20:
        risk_level = "medium"

    recommendations = []
    if conflict_lines:
        recommendations.append("Resolve conflicts in a dedicated worktree before merging")
        recommendations.append("Run verification commands after conflict resolution and before commit")
    else:
        recommendations.append("Review merge preview and run tests before final merge")
    if ours_behind > 0:
        recommendations.append("Rebase or merge latest target branch changes before final merge")
    if len(changed_files) > 40:
        recommendations.append("Split merge into smaller batches to reduce risk")

    can_auto_merge = not conflict_lines and len(changed_files) <= 40

    return {
        "current_branch": current_branch,
        "target_branch": safe_target,
        "base_branch": base,
        "ahead_behind": ahead_behind,
        "stat": stat,
        "changed_files": changed_files,
        "conflicts": len(conflict_lines) > 0,
        "conflict_files": conflict_files,
        "risk_level": risk_level,
        "can_auto_merge": can_auto_merge,
        "safety_recommendations": recommendations,
        "conflict_preview": "\n".join(conflict_lines[:12]),
        "merge_preview": merge_preview,
    }


def git_conflict_resolution_guide(project_path: str, target_branch: str) -> dict[str, Any]:
    assist = git_merge_assist(project_path, target_branch)
    current_branch = assist["current_branch"]
    safe_target = assist["target_branch"]

    unresolved_output = _run_git(project_path, "diff", "--name-only", "--diff-filter=U")
    unresolved_files = [line.strip() for line in unresolved_output.splitlines() if line.strip()]
    conflict_files = unresolved_files or assist.get("conflict_files", [])

    steps: list[dict[str, str]] = [
        {
            "title": "Create isolated merge worktree",
            "command": f"git worktree add .codeforge/worktrees/resolve-{safe_target.replace('/', '_')} {current_branch}",
            "reason": "Resolve conflicts in isolation without disturbing your main working directory.",
        },
        {
            "title": "Fetch latest refs",
            "command": "git fetch --all --prune",
            "reason": "Ensure merge decisions use the latest remote history.",
        },
        {
            "title": "Start merge",
            "command": f"git merge {safe_target}",
            "reason": "Reproduce the merge conflict context to resolve explicitly.",
        },
    ]

    if conflict_files:
        for file_path in conflict_files[:8]:
            steps.append(
                {
                    "title": f"Resolve conflict in {file_path}",
                    "command": f"git checkout --ours -- \"{file_path}\"  # or --theirs; then edit manually",
                    "reason": "Pick sides per hunk and manually combine logic where needed.",
                }
            )

    steps.extend(
        [
            {
                "title": "Mark files resolved",
                "command": "git add <resolved-files>",
                "reason": "Staging is required for conflict-aware commit safety checks.",
            },
            {
                "title": "Run verification",
                "command": "npm test  # or project-specific verify command",
                "reason": "Validate merge result before finalizing commit.",
            },
            {
                "title": "Finalize merge commit",
                "command": "git commit -m \"resolve merge conflicts\"",
                "reason": "Create explicit conflict-resolution history.",
            },
        ]
    )

    notes = [
        f"Risk level: {assist.get('risk_level', 'unknown')}",
        "Use smaller follow-up commits if conflict resolution touches many files.",
    ]
    if assist.get("can_auto_merge"):
        notes.append("Merge-assist indicates auto-merge is likely safe, but verification is still recommended.")

    return {
        "current_branch": current_branch,
        "target_branch": safe_target,
        "conflict_files": conflict_files,
        "has_conflicts": bool(conflict_files),
        "steps": steps,
        "notes": notes,
    }


def git_conflict_assisted_apply(project_path: str, target_branch: str, strategy: str, paths: list[str] | None = None) -> dict[str, Any]:
    safe_target = _safe_branch_name(target_branch)
    side = strategy.strip().lower()
    if side not in {"ours", "theirs"}:
        raise GitError("strategy must be 'ours' or 'theirs'")

    current_branch = _run_git(project_path, "branch", "--show-current") or "HEAD"
    unresolved_output = _run_git(project_path, "diff", "--name-only", "--diff-filter=U")
    unresolved_files = [line.strip() for line in unresolved_output.splitlines() if line.strip()]
    if not unresolved_files:
        raise GitError("No unresolved conflicts found")

    selected = unresolved_files
    if paths:
        requested = [item.strip() for item in paths if item and item.strip()]
        selected = [item for item in unresolved_files if item in requested]
        if not selected:
            raise GitError("Requested paths are not unresolved conflict files")

    checkout_flag = "--ours" if side == "ours" else "--theirs"
    _run_git(project_path, "checkout", checkout_flag, "--", *selected)
    _run_git(project_path, "add", "--", *selected)

    remaining_output = _run_git(project_path, "diff", "--name-only", "--diff-filter=U")
    remaining = [line.strip() for line in remaining_output.splitlines() if line.strip()]

    next_steps = [
        "Inspect staged conflict resolutions with git diff --cached",
        "Run your verification command (tests/lint/build)",
        "Commit with an explicit conflict-resolution message",
    ]

    return {
        "current_branch": current_branch,
        "target_branch": safe_target,
        "strategy": side,
        "applied_paths": selected,
        "remaining_conflicts": remaining,
        "next_steps": next_steps,
    }


def git_fetch(project_path: str, remote: str = "origin") -> dict[str, Any]:
    output = _run_git(project_path, "fetch", remote)
    return {"remote": remote, "output": output}


def git_pull(project_path: str, remote: str = "origin", branch: str | None = None) -> dict[str, Any]:
    head = branch or _run_git(project_path, "rev-parse", "--abbrev-ref", "HEAD")
    output = _run_git(project_path, "pull", remote, head)
    return {"branch": head, "remote": remote, "output": output}


def git_push(project_path: str, remote: str = "origin", branch: str | None = None) -> dict[str, Any]:
    head = branch or _run_git(project_path, "rev-parse", "--abbrev-ref", "HEAD")
    output = _run_git(project_path, "push", remote, head)
    return {"branch": head, "remote": remote, "output": output}

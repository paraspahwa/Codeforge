from __future__ import annotations

import os
import subprocess
from typing import Any

from .git_ops import GitError, _repo_root, _run_git


class PrError(RuntimeError):
    pass


async def create_pull_request(
    *,
    project_path: str,
    title: str,
    body: str,
    provider: str = "github",
    base_branch: str | None = None,
) -> dict[str, Any]:
    cleaned_title = title.strip()
    if not cleaned_title:
        raise PrError("PR title is required")

    head = _run_git(project_path, "rev-parse", "--abbrev-ref", "HEAD")
    base = base_branch or _run_git(project_path, "symbolic-ref", "refs/remotes/origin/HEAD").split("/")[-1]
    if not base:
        base = "main"

    if provider == "gitlab":
        return await _create_gitlab_mr(project_path, cleaned_title, body, head, base)
    return await _create_github_pr(project_path, cleaned_title, body, head, base)


async def _create_github_pr(
    project_path: str,
    title: str,
    body: str,
    head: str,
    base: str,
) -> dict[str, Any]:
    token = os.getenv("GH_TOKEN", "").strip()
    if shutil_which("gh") and token:
        return _gh_pr_create(project_path, title, body, head, base)
    if token:
        return await _github_api_pr(project_path, title, body, head, base, token)
    raise PrError("Set GH_TOKEN or install gh CLI for GitHub PR creation")


def shutil_which(cmd: str) -> str | None:
    from shutil import which

    return which(cmd)


def _gh_pr_create(project_path: str, title: str, body: str, head: str, base: str) -> dict[str, Any]:
    root = _repo_root(project_path)
    env = os.environ.copy()
    if os.getenv("GH_TOKEN"):
        env["GH_TOKEN"] = os.getenv("GH_TOKEN", "")
    result = subprocess.run(
        ["gh", "pr", "create", "--title", title, "--body", body, "--base", base, "--head", head],
        cwd=str(root),
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    if result.returncode != 0:
        raise PrError(result.stderr or result.stdout or "gh pr create failed")
    url = (result.stdout or "").strip()
    return {"message": "GitHub PR created", "url": url, "provider": "github"}


async def _github_api_pr(project_path: str, title: str, body: str, head: str, base: str, token: str) -> dict[str, Any]:
    import httpx

    remote = _run_git(project_path, "remote", "get-url", "origin")
    owner_repo = _parse_github_remote(remote)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"https://api.github.com/repos/{owner_repo}/pulls",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            json={"title": title, "body": body, "head": head, "base": base},
        )
    if response.status_code >= 400:
        raise PrError(response.text)
    payload = response.json()
    return {"message": "GitHub PR created", "url": payload.get("html_url"), "provider": "github", "number": payload.get("number")}


async def _create_gitlab_mr(
    project_path: str,
    title: str,
    body: str,
    head: str,
    base: str,
) -> dict[str, Any]:
    token = os.getenv("GITLAB_TOKEN", "").strip()
    host = os.getenv("GITLAB_HOST", "https://gitlab.com").rstrip("/")
    if not token:
        raise PrError("GITLAB_TOKEN is required for GitLab MR creation")

    remote = _run_git(project_path, "remote", "get-url", "origin")
    project_path_encoded = _parse_gitlab_remote(remote)
    import httpx

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{host}/api/v4/projects/{project_path_encoded}/merge_requests",
            headers={"PRIVATE-TOKEN": token},
            json={"title": title, "description": body, "source_branch": head, "target_branch": base},
        )
    if response.status_code >= 400:
        raise PrError(response.text)
    payload = response.json()
    return {
        "message": "GitLab MR created",
        "url": payload.get("web_url"),
        "provider": "gitlab",
        "iid": payload.get("iid"),
    }


def _parse_github_remote(remote: str) -> str:
    remote = remote.strip()
    if remote.startswith("git@"):
        remote = remote.split(":", 1)[-1]
    remote = remote.removeprefix("https://github.com/").removesuffix(".git")
    return remote


def _parse_gitlab_remote(remote: str) -> str:
    from urllib.parse import quote

    remote = remote.strip().removeprefix("https://").removeprefix("git@")
    remote = remote.split(":", 1)[-1].removesuffix(".git")
    return quote(remote, safe="")


def git_push(project_path: str, remote: str = "origin", branch: str | None = None) -> dict[str, Any]:
    head = branch or _run_git(project_path, "rev-parse", "--abbrev-ref", "HEAD")
    output = _run_git(project_path, "push", remote, head)
    return {"branch": head, "remote": remote, "output": output}


def git_pull(project_path: str, remote: str = "origin", branch: str | None = None) -> dict[str, Any]:
    head = branch or _run_git(project_path, "rev-parse", "--abbrev-ref", "HEAD")
    output = _run_git(project_path, "pull", remote, head)
    return {"branch": head, "remote": remote, "output": output}


def git_fetch(project_path: str, remote: str = "origin") -> dict[str, Any]:
    output = _run_git(project_path, "fetch", remote)
    return {"remote": remote, "output": output}

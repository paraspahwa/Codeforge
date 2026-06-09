#!/usr/bin/env python3
"""Patch ECS API task definitions to enable or disable OIDC."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def set_container_env(taskdef: dict, container_name: str, env_name: str, env_value: str) -> None:
    for container in taskdef.get("containerDefinitions", []):
        if container.get("name") != container_name:
            continue
        environment = container.setdefault("environment", [])
        for entry in environment:
            if entry.get("name") == env_name:
                entry["value"] = env_value
                return
        environment.append({"name": env_name, "value": env_value})
        return
    raise KeyError(f"Container {container_name} not found in task definition")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", choices=["staging", "production"], required=True)
    parser.add_argument("--enabled", choices=["true", "false"], required=True)
    parser.add_argument("--repo-root", default=".")
    args = parser.parse_args()

    path = Path(args.repo_root) / "infra" / "ecs" / args.environment / "taskdef-api.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    set_container_env(doc, "codeforge-api", "CODEFORGE_OIDC_ENABLED", args.enabled)
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"Patched {path} CODEFORGE_OIDC_ENABLED={args.enabled}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

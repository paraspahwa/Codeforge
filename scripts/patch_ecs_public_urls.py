#!/usr/bin/env python3
"""Patch ECS task definitions with environment-specific public URLs."""

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
    parser.add_argument("--web-url", required=True, help="Public web origin, e.g. https://staging.example.com")
    parser.add_argument("--api-url", required=True, help="Public API origin, e.g. https://api-staging.example.com")
    parser.add_argument("--repo-root", default=".")
    args = parser.parse_args()

    if "PLACEHOLDER" in args.web_url or "PLACEHOLDER" in args.api_url:
        print("Refusing to patch task definitions with placeholder URLs", file=sys.stderr)
        return 1

    root = Path(args.repo_root)
    api_path = root / "infra" / "ecs" / args.environment / "taskdef-api.json"
    web_path = root / "infra" / "ecs" / args.environment / "taskdef-web.json"

    api_doc = json.loads(api_path.read_text(encoding="utf-8"))
    web_doc = json.loads(web_path.read_text(encoding="utf-8"))

    api_origin = args.api_url.rstrip("/")
    set_container_env(api_doc, "codeforge-api", "CODEFORGE_WEB_BASE_URL", args.web_url.rstrip("/"))
    set_container_env(api_doc, "codeforge-api", "CODEFORGE_PUBLIC_API_BASE", api_origin)
    set_container_env(web_doc, "codeforge-web", "NEXT_PUBLIC_API_BASE", api_origin)

    api_path.write_text(json.dumps(api_doc, indent=2) + "\n", encoding="utf-8")
    web_path.write_text(json.dumps(web_doc, indent=2) + "\n", encoding="utf-8")

    print(f"Patched {api_path} CODEFORGE_WEB_BASE_URL={args.web_url.rstrip('/')}")
    print(f"Patched {api_path} CODEFORGE_PUBLIC_API_BASE={api_origin}")
    print(f"Patched {web_path} NEXT_PUBLIC_API_BASE={api_origin}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

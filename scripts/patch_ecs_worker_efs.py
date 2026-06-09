#!/usr/bin/env python3
"""Patch ECS worker task definitions with the environment EFS filesystem id."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", choices=["staging", "production"], required=True)
    parser.add_argument("--efs-file-system-id", required=True)
    parser.add_argument("--repo-root", default=".")
    args = parser.parse_args()

    efs_id = args.efs_file_system_id.strip()
    if not efs_id or efs_id == "fs-PLACEHOLDER":
        print("Refusing to patch worker task definition with placeholder EFS id", file=sys.stderr)
        return 1

    path = Path(args.repo_root) / "infra" / "ecs" / args.environment / "taskdef-worker.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    volumes = doc.get("volumes") or []
    if not volumes:
        print(f"No volumes found in {path}", file=sys.stderr)
        return 1

    efs_config = volumes[0].get("efsVolumeConfiguration")
    if not isinstance(efs_config, dict):
        print(f"No efsVolumeConfiguration in first volume of {path}", file=sys.stderr)
        return 1

    efs_config["fileSystemId"] = efs_id
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"Patched {path} fileSystemId={efs_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

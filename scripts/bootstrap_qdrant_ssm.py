#!/usr/bin/env python3
"""Bootstrap CodeForge Qdrant SSM parameters for ECS API/worker task definitions."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

SSM_PREFIX_BY_ENV = {
    "staging": "codeforge/staging",
    "production": "codeforge/prod",
}


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def put_parameter(*, region: str, name: str, value: str, dry_run: bool) -> None:
    if not value:
        print(f"skip {name}: empty value")
        return
    command = [
        "aws",
        "ssm",
        "put-parameter",
        "--region",
        region,
        "--name",
        name,
        "--value",
        value,
        "--type",
        "String",
        "--overwrite",
    ]
    if dry_run:
        print("DRY RUN:", " ".join(command[:6]), "...")
        return
    subprocess.run(command, check=True)
    print(f"wrote {name}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", choices=["staging", "production"], required=True)
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "ap-south-1"))
    parser.add_argument("--prefix", default=None, help="SSM path prefix, default codeforge/<env>")
    parser.add_argument("--env-file", default=".env.qdrant", help="Optional KEY=VALUE file")
    parser.add_argument(
        "--internal-url",
        default="",
        help="Override QDRANT_URL (e.g. Terraform output qdrant_url: http://qdrant.codeforge-staging.local:6333)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    prefix = args.prefix or SSM_PREFIX_BY_ENV[args.environment]
    file_values = load_dotenv(Path(args.env_file))
    qdrant_url = args.internal_url.strip() or os.getenv("QDRANT_URL") or file_values.get("QDRANT_URL", "")

    if not qdrant_url:
        print("Missing QDRANT_URL (set env var or provide --env-file)", file=sys.stderr)
        return 1

    put_parameter(
        region=args.region,
        name=f"/{prefix}/QDRANT_URL",
        value=qdrant_url,
        dry_run=args.dry_run,
    )

    print("\nSee docs/qdrant-ecs-setup.md for hosting options and security group notes.")
    print(f"Done. Task definitions should reference arn:aws:ssm:{args.region}:<account>:parameter/{prefix}/QDRANT_URL")
    return 0


if __name__ == "__main__":
    sys.exit(main())

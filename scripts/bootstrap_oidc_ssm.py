#!/usr/bin/env python3
"""Bootstrap CodeForge OIDC SSM parameters for ECS API task definitions."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

OIDC_PARAMETERS = [
    "CODEFORGE_OIDC_ISSUER",
    "CODEFORGE_OIDC_AUDIENCE",
    "CODEFORGE_OIDC_JWKS_URI",
    "CODEFORGE_OIDC_CLIENT_ID",
    "CODEFORGE_OIDC_CLIENT_SECRET",
    "CODEFORGE_OIDC_REDIRECT_URI",
]

SSM_PREFIX_BY_ENV = {
    "staging": "codeforge/staging",
    "production": "codeforge/prod",
}

REDIRECT_URI_CHECKLIST = [
    ("Web", "http://localhost:3000/auth/callback"),
    ("Web (staging)", "https://YOUR-STAGING-WEB-DOMAIN/auth/callback"),
    ("Web (production)", "https://YOUR-PRODUCTION-WEB-DOMAIN/auth/callback"),
    ("Desktop", "http://localhost:1420/auth/callback"),
    ("Terminal", "http://127.0.0.1:4583/auth/callback"),
    ("VS Code", "http://127.0.0.1:4584/auth/callback"),
]


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


def put_parameter(*, region: str, name: str, value: str, secure: bool, dry_run: bool) -> None:
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
        "SecureString" if secure else "String",
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
    parser.add_argument("--prefix", default=None, help="SSM path prefix, default codeforge/<environment>")
    parser.add_argument("--env-file", default=".env.oidc", help="Optional KEY=VALUE file for OIDC settings")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--print-checklist", action="store_true", help="Print IdP redirect URI checklist and exit")
    args = parser.parse_args()

    if args.print_checklist:
        print("Register these redirect URIs in your IdP application:")
        for label, uri in REDIRECT_URI_CHECKLIST:
            print(f"- {label}: {uri}")
        return 0

    prefix = args.prefix or SSM_PREFIX_BY_ENV[args.environment]
    file_values = load_dotenv(Path(args.env_file))
    secure_names = {"CODEFORGE_OIDC_CLIENT_SECRET"}

    missing = []
    for key in OIDC_PARAMETERS:
        value = os.getenv(key) or file_values.get(key, "")
        parameter_name = f"/{prefix}/{key}"
        if not value:
            missing.append(key)
            continue
        put_parameter(
            region=args.region,
            name=parameter_name,
            value=value,
            secure=key in secure_names,
            dry_run=args.dry_run,
        )

    print("\nIdP redirect URI checklist:")
    for label, uri in REDIRECT_URI_CHECKLIST:
        print(f"- {label}: {uri}")

    if missing:
        print("\nMissing values (set env vars or provide --env-file):", ", ".join(missing))
        return 1

    print(f"\nDone. Ensure API task definition references arn:aws:ssm:{args.region}:<account>:parameter/{prefix}/CODEFORGE_OIDC_*")
    return 0


if __name__ == "__main__":
    sys.exit(main())

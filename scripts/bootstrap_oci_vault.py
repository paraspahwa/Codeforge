#!/usr/bin/env python3
"""Bootstrap secrets into OCI Vault for CodeForge container instances."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

SECRETS = [
    "DATABASE_URL",
    "SUPABASE_JWT_SECRET",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "OPENAI_API_KEY",
    "REDIS_URL",
    "CELERY_BROKER_URL",
    "CELERY_RESULT_BACKEND",
    "QDRANT_URL",
    "CODEFORGE_OIDC_ISSUER",
    "CODEFORGE_OIDC_AUDIENCE",
    "CODEFORGE_OIDC_JWKS_URI",
    "CODEFORGE_OIDC_CLIENT_ID",
    "CODEFORGE_OIDC_CLIENT_SECRET",
    "CODEFORGE_OIDC_REDIRECT_URI",
    "DEEPSEEK_API_KEY",
    "ANTHROPIC_API_KEY",
]

VAULT_PREFIX_BY_ENV = {
    "staging": "codeforge_staging",
    "production": "codeforge_prod",
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


def vault_secret_exists(*, vault_id: str, name: str) -> bool:
    try:
        subprocess.run(
            ["oci", "vault", "secret", "get",
             "--vault-id", vault_id,
             "--secret-name", name,
             "--query", "data.id"],
            capture_output=True, check=True, timeout=15,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def create_secret(*, vault_id: str, compartment_id: str, name: str, value: str, key_id: str, dry_run: bool) -> None:
    if not value:
        print(f"  skip {name}: empty value")
        return

    # Base64-encode the secret content as required by OCI Vault
    encoded = subprocess.run(
        ["base64", "-w0"],
        input=value.encode("utf-8"),
        capture_output=True, check=True, timeout=10,
    ).stdout.decode("utf-8").strip()

    command = [
        "oci", "vault", "secret", "create-base64",
        "--vault-id", vault_id,
        "--compartment-id", compartment_id,
        "--secret-name", name,
        "--description", f"CodeForge {name}",
        "--key-id", key_id,
        "--secret-content-content", encoded,
        "--secret-content-name", name,
        "--secret-content-stage", "CURRENT",
    ]
    if dry_run:
        print(f"  DRY RUN: oci vault secret create-base64 --secret-name {name} ...")
        return
    try:
        subprocess.run(command, check=True, timeout=30, capture_output=True)
        print(f"  created {name}")
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode() if exc.stderr else "unknown error"
        if "already exists" in stderr:
            print(f"  skip {name}: already exists")
        else:
            print(f"  ERROR creating {name}: {stderr}")


def update_secret(*, vault_id: str, secret_id: str, value: str, dry_run: bool) -> None:
    if not value:
        print(f"  skip update: empty value")
        return

    encoded = subprocess.run(
        ["base64", "-w0"],
        input=value.encode("utf-8"),
        capture_output=True, check=True, timeout=10,
    ).stdout.decode("utf-8").strip()

    command = [
        "oci", "vault", "secret", "update-base64",
        "--secret-id", secret_id,
        "--secret-content-content", encoded,
        "--secret-content-name", "content",
        "--secret-content-stage", "CURRENT",
        "--force",
    ]
    if dry_run:
        print(f"  DRY RUN: oci vault secret update-base64 --secret-id {secret_id} ...")
        return
    subprocess.run(command, check=True, timeout=30)
    print(f"  updated secret {secret_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", choices=["staging", "production"], required=True)
    parser.add_argument("--vault-id", required=True, help="OCI Vault OCID")
    parser.add_argument("--compartment-id", required=True, help="Compartment OCID")
    parser.add_argument("--key-id", required=True, help="Master encryption key OCID in the vault")
    parser.add_argument("--env-file", default=".env.production", help="KEY=VALUE file with secrets")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    prefix = VAULT_PREFIX_BY_ENV[args.environment]
    file_values = load_dotenv(Path(args.env_file))

    missing = []
    for key in SECRETS:
        value = os.getenv(key) or file_values.get(key, "")
        secret_name = f"{prefix}_{key}"

        if not value:
            missing.append(key)
            continue

        if vault_secret_exists(vault_id=args.vault_id, name=secret_name):
            print(f"  {secret_name}: exists (use OCI Console to update)")
        else:
            create_secret(
                vault_id=args.vault_id,
                compartment_id=args.compartment_id,
                name=secret_name,
                value=value,
                key_id=args.key_id,
                dry_run=args.dry_run,
            )

    if missing:
        print("\nMissing values (set env vars or provide --env-file):")
        for key in missing:
            print(f"  - {key}")
        return 1

    print(f"\nDone. Set OCI_VAULT_SECRET_{args.environment.upper()} as a GitHub Actions variable.")
    print("Container instances should reference these secrets via environment variable secrets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

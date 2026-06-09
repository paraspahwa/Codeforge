#!/usr/bin/env python3
"""Bootstrap CodeForge Razorpay SSM parameters for ECS API task definitions."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

RAZORPAY_PARAMETERS = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
]

SSM_PREFIX_BY_ENV = {
    "staging": "codeforge/staging",
    "production": "codeforge/prod",
}

WEBHOOK_EVENTS = [
    "payment.captured",
    "payment.authorized",
    "payment.failed",
    "order.paid",
    "subscription.cancelled",
    "subscription.halted",
    "subscription.completed",
    "subscription.paused",
    "subscription.charged",
    "subscription.activated",
    "subscription.resumed",
    "subscription.updated",
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
    parser.add_argument("--prefix", default=None, help="SSM path prefix, default codeforge/<env>")
    parser.add_argument("--env-file", default=".env.razorpay", help="Optional KEY=VALUE file for Razorpay settings")
    parser.add_argument("--api-public-url", default="", help="Public API origin for webhook URL checklist")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--print-checklist", action="store_true", help="Print Razorpay dashboard checklist and exit")
    args = parser.parse_args()

    api_public_url = args.api_public_url.strip() or os.getenv("CODEFORGE_PUBLIC_API_BASE", "").strip()
    webhook_url = f"{api_public_url.rstrip('/')}/api/v1/billing/webhook" if api_public_url else "https://<api-host>/api/v1/billing/webhook"

    if args.print_checklist:
        print("Razorpay dashboard checklist:")
        print(f"- Webhook URL: {webhook_url}")
        print("- Events to enable:")
        for event in WEBHOOK_EVENTS:
            print(f"  - {event}")
        print("- Use test keys for staging; live keys only for production")
        return 0

    prefix = args.prefix or SSM_PREFIX_BY_ENV[args.environment]
    file_values = load_dotenv(Path(args.env_file))
    secure_names = {"RAZORPAY_KEY_SECRET"}

    missing = []
    for key in RAZORPAY_PARAMETERS:
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

    print("\nRazorpay dashboard checklist:")
    print(f"- Webhook URL: {webhook_url}")
    print("- Events:", ", ".join(WEBHOOK_EVENTS[:4]), ", subscription.* (see docs/razorpay-webhook-setup.md)")

    if missing:
        print("\nMissing values (set env vars or provide --env-file):", ", ".join(missing))
        return 1

    print(f"\nDone. API task definition should reference arn:aws:ssm:{args.region}:<account>:parameter/{prefix}/RAZORPAY_*")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Verify OIDC cutover readiness against a running API."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", required=True, help="API origin, e.g. https://api-staging.example.com")
    args = parser.parse_args()

    url = f"{args.api_base.rstrip('/')}/api/v1/platform/deploy-readiness?probe_discovery=true"
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        print(f"HTTP {exc.code} from deploy-readiness", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"Failed to reach deploy-readiness: {exc}", file=sys.stderr)
        return 1

    if not payload.get("oidc_enabled"):
        print("OIDC is not enabled on the API — skipping cutover verification")
        return 0

    if not payload.get("ready"):
        failed = [
            check["name"]
            for check in payload.get("checks", [])
            if check.get("required", True) and not check.get("ok")
        ]
        print("Deploy readiness failed:", ", ".join(failed) or "unknown")
        return 1

    discovery = payload.get("oidc_discovery") or {}
    if not discovery.get("ok"):
        print("OIDC discovery probe failed:", discovery.get("detail", "unknown"))
        return 1

    dev_login_check = next(
        (check for check in payload.get("checks", []) if check.get("name") == "dev_login_disabled_under_oidc"),
        None,
    )
    if dev_login_check and not dev_login_check.get("ok"):
        print("Dev-login is still enabled while OIDC is on")
        return 1

    print("OIDC cutover readiness passed")
    print("issuer:", discovery.get("issuer"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

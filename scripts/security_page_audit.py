#!/usr/bin/env python3
"""Runtime security + page health audit for CodeForge."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

LOG_PATH = Path("/home/ubuntu/Codeforge-1/.cursor/debug-074757.log")
SESSION_ID = "074757"
WEB_BASE = os.getenv("AUDIT_WEB_BASE", "http://localhost:3000")
API_BASE = os.getenv("AUDIT_API_BASE", "http://localhost:8000")


def log_event(*, hypothesis_id: str, location: str, message: str, data: dict, run_id: str = "audit") -> None:
    payload = {
        "sessionId": SESSION_ID,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload) + "\n")


def http_request(url: str, *, method: str = "GET", headers: dict | None = None, body: dict | None = None) -> dict:
    req_headers = dict(headers or {})
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return {"status": response.status, "body": raw[:500]}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        return {"status": exc.code, "body": raw[:500]}
    except Exception as exc:  # noqa: BLE001
        return {"status": 0, "body": str(exc)[:500]}


def main() -> None:
    pages = [
        "/",
        "/agents",
        "/code",
        "/extensions",
        "/mcp",
        "/features",
        "/cowork",
        "/sessions",
        "/team",
        "/analytics",
        "/settings",
        "/billing",
        "/login",
        "/share/test-share-id",
        "/auth/callback",
    ]

    for page in pages:
        result = http_request(f"{WEB_BASE}{page}")
        log_event(
            hypothesis_id="PAGE",
            location="security_page_audit.py:pages",
            message="page_health_check",
            data={"page": page, "status": result["status"], "ok": result["status"] == 200},
        )

    unauth_sensitive = [
        "/api/v1/sessions",
        "/api/v1/extensions/catalog",
        "/api/v1/mcp/catalog",
        "/api/v1/usage/summary",
        "/api/v1/sessions/fake-id/messages",
        "/api/v1/sessions/fake-id/files/content?path=README.md",
    ]
    for path in unauth_sensitive:
        result = http_request(f"{API_BASE}{path}")
        log_event(
            hypothesis_id="A",
            location="security_page_audit.py:unauth_api",
            message="unauthenticated_sensitive_api",
            data={"path": path, "status": result["status"], "secured": result["status"] == 401},
        )

    public_endpoints = ["/api/v1/agents", "/api/v1/billing/plans", "/health"]
    for path in public_endpoints:
        result = http_request(f"{API_BASE}{path}")
        log_event(
            hypothesis_id="B",
            location="security_page_audit.py:public_api",
            message="public_api_exposure",
            data={"path": path, "status": result["status"], "public_ok": result["status"] == 200},
        )

    dev_login = http_request(f"{API_BASE}/api/v1/auth/dev-login", method="POST", body={"user_id": "audit-attacker"})
    log_event(
        hypothesis_id="D",
        location="security_page_audit.py:dev_login",
        message="dev_login_probe",
        data={
            "status": dev_login["status"],
            "enabled": dev_login["status"] == 200,
            "risk": "high" if dev_login["status"] == 200 else "mitigated",
        },
    )

    token_a = None
    token_b = None
    if dev_login["status"] == 200:
        token_a = json.loads(dev_login["body"]).get("access_token")
        dev_b = http_request(
            f"{API_BASE}/api/v1/auth/dev-login",
            method="POST",
            body={"user_id": "audit-victim"},
        )
        if dev_b["status"] == 200:
            token_b = json.loads(dev_b["body"]).get("access_token")

    if token_a and token_b:
        create_a = http_request(
            f"{API_BASE}/api/v1/sessions",
            method="POST",
            headers={"Authorization": f"Bearer {token_a}"},
            body={"project_path": "/workspaces"},
        )
        session_id = None
        if create_a["status"] == 200:
            session_id = json.loads(create_a["body"]).get("session_id")
        if session_id:
            idor = http_request(
                f"{API_BASE}/api/v1/sessions/{session_id}/messages",
                headers={"Authorization": f"Bearer {token_b}"},
            )
            log_event(
                hypothesis_id="F",
                location="security_page_audit.py:idor",
                message="cross_user_session_access",
                data={
                    "session_id": session_id,
                    "status": idor["status"],
                    "secured": idor["status"] in {401, 403, 404},
                },
            )

        traversal = http_request(
            f"{API_BASE}/api/v1/sessions/fake-id/files/content?path=../../../etc/passwd",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        log_event(
            hypothesis_id="C",
            location="security_page_audit.py:traversal",
            message="path_traversal_probe",
            data={"status": traversal["status"], "body_snip": traversal["body"][:120]},
        )

    print(f"Audit complete. Logs written to {LOG_PATH}")


if __name__ == "__main__":
    main()

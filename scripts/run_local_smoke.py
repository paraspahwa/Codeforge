#!/usr/bin/env python3
"""Local smoke checks via FastAPI TestClient (no live uvicorn required)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_DIR = ROOT / "services" / "api"
sys.path.insert(0, str(API_DIR))

# Isolate from .env.local remote services — mirror pytest/conftest defaults.
os.environ.setdefault("CODEFORGE_ENV", "development")
os.environ.pop("DATABASE_URL", None)
os.environ.pop("PGHOST", None)
os.environ.pop("QDRANT_URL", None)
os.environ.pop("REDIS_URL", None)
os.environ.pop("CELERY_BROKER_URL", None)
os.environ["CODEFORGE_COWORK_SCHEDULER_ENABLED"] = "false"
os.environ["CODEFORGE_EMBEDDING_MODEL"] = ""
os.environ.setdefault("SUPABASE_JWT_SECRET", "local-smoke-jwt")

import app.db as db_module  # noqa: E402
import app.state as state_module  # noqa: E402
from app.db import init_db  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

db_module.DATABASE_URL = ""
state_module.vector_store._client = None
state_module.vector_store._backend = "memory"
state_module.vector_store._memory_points = []
state_module.vector_store._embedding_source = "deterministic"
init_db()

from app.main import app  # noqa: E402


def main() -> int:
    results: dict[str, object] = {"checks": []}
    failed = 0

    with TestClient(app) as client:
        r = client.get("/health")
        ok = r.status_code == 200 and r.json().get("status") == "ok"
        results["checks"].append({"name": "health", "ok": ok, "body": r.json()})
        failed += 0 if ok else 1

        r = client.get("/api/v1/platform/deploy-readiness")
        body = r.json()
        ok = body.get("ready") is True
        results["checks"].append({"name": "deploy_readiness", "ok": ok, "body": body})
        failed += 0 if ok else 1

        r = client.get("/api/v1/platform/stack-status")
        stack = r.json()
        results["checks"].append({"name": "stack_status", "ok": r.status_code == 200, "body": stack})

        r = client.post("/api/v1/auth/dev-login", json={"user_id": "smoke-user"})
        login = r.json()
        token = login.get("access_token", "")
        ok = bool(token)
        results["checks"].append({"name": "dev_login", "ok": ok})
        failed += 0 if ok else 1

        headers = {"Authorization": f"Bearer {token}"}
        r = client.post("/api/v1/sessions", json={"title": "smoke session"}, headers=headers)
        session_ok = r.status_code == 200
        session_id = r.json().get("session_id") if session_ok else None
        results["checks"].append(
            {"name": "create_session", "ok": session_ok, "session_id": session_id}
        )
        failed += 0 if session_ok else 1

        r = client.get("/api/v1/sessions", headers=headers)
        list_ok = r.status_code == 200
        results["checks"].append({"name": "list_sessions", "ok": list_ok, "count": len(r.json())})
        failed += 0 if list_ok else 1

        r = client.get("/api/v1/usage/summary", headers=headers)
        results["checks"].append(
            {"name": "usage_summary", "ok": r.status_code == 200, "body": r.json()}
        )

        r = client.get("/api/v1/billing/context", headers=headers)
        results["checks"].append(
            {"name": "billing_context", "ok": r.status_code == 200, "body": r.json()}
        )

        r = client.post("/api/v1/platform/queue-ping")
        queue = r.json()
        inline_ok = queue.get("backend") == "inline"
        results["checks"].append(
            {
                "name": "queue_ping",
                "ok": r.status_code == 200,
                "backend": queue.get("backend"),
                "expected_degraded": inline_ok,
            }
        )

    results["failed"] = failed
    results["passed"] = failed == 0
    print(json.dumps(results, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

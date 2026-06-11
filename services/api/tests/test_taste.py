from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.db import init_db, insert_agent_proposal, insert_session


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_session(client, headers: dict[str, str], project: Path) -> str:
    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    assert created.status_code == 200
    return created.json()["session_id"]


def _insert_pending_proposal(
    *,
    session_id: str,
    user_id: str,
    target_file: str,
    original: str,
    proposed: str,
) -> str:
    proposal_id = f"prop_{uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    insert_agent_proposal(
        proposal_id=proposal_id,
        session_id=session_id,
        user_id=user_id,
        target_file=target_file,
        prompt="update file",
        original_content=original,
        proposed_content=proposed,
        patch_preview="@@ patch",
        status="pending",
        created_at=now,
    )
    return proposal_id


def test_reject_proposal_creates_taste_rules(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "taste-demo"
    project.mkdir()
    target = project / "main.py"
    target.write_text("def run():\n    pass\n", encoding="utf-8")

    headers = _auth_headers(client, "taste-reject-user")
    session_id = _create_session(client, headers, project)
    proposal_id = _insert_pending_proposal(
        session_id=session_id,
        user_id="taste-reject-user",
        target_file="main.py",
        original=target.read_text(encoding="utf-8"),
        proposed="def run():\n    pass  # TODO fix\n",
    )

    decision = client.post(
        f"/api/v1/sessions/{session_id}/proposals/{proposal_id}/decision",
        headers=headers,
        json={"action": "reject", "note": "No TODO markers"},
    )
    assert decision.status_code == 200

    rules = client.get("/api/v1/taste/rules", headers=headers)
    assert rules.status_code == 200
    payload = rules.json()
    assert payload["rules"]
    assert "TODO" in payload["taste_md"] or any("TODO" in rule["rule_text"] for rule in payload["rules"])

    stats = client.get("/api/v1/taste/stats", headers=headers)
    assert stats.status_code == 200
    assert stats.json()["rejections"] >= 1
    assert stats.json()["active_rules"] >= 1


def test_approve_proposal_records_positive_taste_signal(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "taste-approve"
    project.mkdir()
    target = project / "app.py"
    original = "value = 1\n"
    proposed = "value = 2\n"
    target.write_text(original, encoding="utf-8")

    headers = _auth_headers(client, "taste-approve-user")
    session_id = _create_session(client, headers, project)
    proposal_id = _insert_pending_proposal(
        session_id=session_id,
        user_id="taste-approve-user",
        target_file="app.py",
        original=original,
        proposed=proposed,
    )

    decision = client.post(
        f"/api/v1/sessions/{session_id}/proposals/{proposal_id}/decision",
        headers=headers,
        json={"action": "approve"},
    )
    assert decision.status_code == 200
    assert decision.json()["applied"] is True
    assert target.read_text(encoding="utf-8") == proposed

    stats = client.get("/api/v1/taste/stats", headers=headers)
    assert stats.status_code == 200
    assert stats.json()["approvals"] >= 1


def test_taste_import_export_round_trip(client) -> None:
    init_db()
    headers = _auth_headers(client, "taste-import-user")

    export_empty = client.get("/api/v1/taste/export", headers=headers)
    assert export_empty.status_code == 200

    imported = client.post(
        "/api/v1/taste/import",
        headers=headers,
        json={
            "version": 1,
            "rules": [
                {"rule_text": "Prefer Vitest over Jest in TypeScript projects.", "weight": 3},
                {"rule_text": "Use snake_case for Python handlers.", "weight": 2},
            ],
        },
    )
    assert imported.status_code == 200
    assert imported.json()["imported_rules"] == 2

    exported = client.get("/api/v1/taste/export", headers=headers)
    assert exported.status_code == 200
    texts = {rule["rule_text"] for rule in exported.json()["rules"]}
    assert "Prefer Vitest over Jest in TypeScript projects." in texts

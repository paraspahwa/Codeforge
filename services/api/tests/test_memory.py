from __future__ import annotations

from app.db import init_db
from app.memory_service import memory_service


def test_save_and_search_memory(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "memory-user"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    save = client.post(
        "/api/v1/memory/save",
        headers=headers,
        json={
            "content": "Architecture decision: use PGHOST env vars for database URL safety",
            "project_path": "/tmp/demo",
            "scope": "team",
            "kind": "decision",
        },
    )
    assert save.status_code == 200
    body = save.json()
    assert body["kind"] == "decision"
    assert "PGHOST" in body["content"]

    duplicate = client.post(
        "/api/v1/memory/save",
        headers=headers,
        json={"content": body["content"], "project_path": "/tmp/demo"},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["memory_id"] == body["memory_id"]

    search = client.get(
        "/api/v1/memory/search",
        headers=headers,
        params={"q": "PGHOST database"},
    )
    assert search.status_code == 200
    assert len(search.json()["native"]) >= 1

    listed = client.get("/api/v1/memory", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["memories"]) >= 1


def test_compose_memory_context_caps_items() -> None:
    init_db()
    user_id = "memory-compose-user"
    for index in range(8):
        memory_service.save_memory(
            user_id=user_id,
            content=f"Decision {index}: remember architecture pattern for auth module",
            project_path="/tmp/auth",
            scope="personal",
        )

    context = memory_service.compose_memory_context(
        user_id=user_id,
        project_path="/tmp/auth",
        query="auth architecture decision",
    )
    assert "Relevant memories" in context
    assert context.count("- [") <= 5


def test_capture_from_compact_summary() -> None:
    init_db()
    saved = memory_service.capture_from_compact_summary(
        user_id="compact-user",
        session_id="sess_compact",
        project_path="/tmp/project",
        summary="Recent messages:\n- user: remember we fixed DATABASE_URL parsing bug",
    )
    assert len(saved) >= 1

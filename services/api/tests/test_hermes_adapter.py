from __future__ import annotations

import pytest

from app import hermes_adapter
from app.db import init_db
from app.skills_service import skills_service


def test_normalize_hermes_event_maps_token_and_tools() -> None:
    token_event = hermes_adapter.normalize_hermes_event({"type": "text_delta", "content": "hello"})
    assert token_event == ("token", {"content": "hello", "model": "hermes"})

    tool_event = hermes_adapter.normalize_hermes_event(
        {"event": "tool_use", "name": "search", "arguments": {"q": "redis"}}
    )
    assert tool_event is not None
    assert tool_event[0] == "tool_call"
    assert tool_event[1]["tool"] == "search"


def test_resolve_agent_engine_respects_env_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CODEFORGE_HERMES_ENABLED", raising=False)
    assert hermes_adapter.resolve_agent_engine({"agent_engine": "hermes"}) == "codeforge"

    monkeypatch.setenv("CODEFORGE_HERMES_ENABLED", "true")
    assert hermes_adapter.resolve_agent_engine({"agent_engine": "hermes"}) == "hermes"


@pytest.mark.asyncio
async def test_stream_hermes_run_simulate_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CODEFORGE_HERMES_SIMULATE", "true")
    monkeypatch.delenv("CODEFORGE_HERMES_BINARY", raising=False)

    events = []
    async for event_type, payload, delta in hermes_adapter.stream_hermes_run(
        prompt="explain caching",
        session_id="sess_sim",
        project_path=None,
        trace_id="trace-1",
    ):
        events.append((event_type, payload, delta))

    types = [item[0] for item in events]
    assert "run_started" in types
    assert "token" in types
    assert "complete" in types
    assert any(delta for _type, _payload, delta in events if _type == "token")


def test_agent_engine_preferences_round_trip(client, monkeypatch: pytest.MonkeyPatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_HERMES_ENABLED", "true")

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "hermes-user"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    update = client.put(
        "/api/v1/agent/preferences",
        headers=headers,
        json={"agent_engine": "hermes"},
    )
    assert update.status_code == 200
    body = update.json()
    assert body["agent_engine"] == "hermes"
    assert "hermes" in body["available_agent_engines"]

    status = client.get("/api/v1/hermes/status", headers=headers)
    assert status.status_code == 200
    status_body = status.json()
    assert status_body["user_engine"] == "hermes"
    assert status_body["env_enabled"] is True
    assert "codeforge" in status_body["available_engines"]


def test_invalid_agent_engine_rejected(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "hermes-invalid"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    update = client.put(
        "/api/v1/agent/preferences",
        headers=headers,
        json={"agent_engine": "openclaw"},
    )
    assert update.status_code == 422


def test_build_hermes_argv_includes_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(hermes_adapter, "hermes_binary_path", lambda: "/usr/bin/hermes")
    argv = hermes_adapter.build_hermes_argv(session_id="abc123", prompt="fix tests")
    assert argv[0] == "/usr/bin/hermes"
    assert "codeforge-abc123" in argv
    assert argv[-1] == "fix tests"


def test_chunk_text_preserves_newlines() -> None:
    chunks = hermes_adapter._chunk_text("ab\ncd")
    assert "".join(chunks).replace("\n", "") == "abcd"


def test_compose_preferences_default_engine() -> None:
    init_db()
    prefs = skills_service.get_preferences("missing-user")
    assert prefs["agent_engine"] == "codeforge"

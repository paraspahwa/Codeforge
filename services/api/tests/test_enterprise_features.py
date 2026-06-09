from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.cowork import extract_structured_data
from app.db import init_db
from app.delegation_orchestrator import parse_agent_roles
from app.projects_team import projects_team_service


def test_parse_agent_roles_from_csv() -> None:
    roles = parse_agent_roles("lead", ["reviewer", "implementer"])
    assert roles == ["reviewer", "implementer"]

    roles = parse_agent_roles("reviewer, implementer, tester")
    assert roles == ["reviewer", "implementer", "tester"]


def test_team_style_guide_crud(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "style-guide-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=headers,
        json={"name": "Design team", "description": "Shared guides"},
    )
    workspace_id = workspace.json()["workspace_id"]

    created = client.post(
        f"/api/v1/team/workspaces/{workspace_id}/style-guides",
        headers=headers,
        json={
            "title": "Frontend style",
            "guide_type": "style",
            "content": "Use 8px spacing grid and semantic HTML landmarks.",
        },
    )
    assert created.status_code == 200
    guide_id = created.json()["guide_id"]

    listed = client.get(f"/api/v1/team/workspaces/{workspace_id}/style-guides", headers=headers)
    assert listed.status_code == 200
    assert any(item["guide_id"] == guide_id for item in listed.json()["guides"])

    updated = client.put(
        f"/api/v1/team/workspaces/{workspace_id}/style-guides/{guide_id}",
        headers=headers,
        json={"content": "Use 8px spacing grid, semantic HTML, and focus-visible outlines."},
    )
    assert updated.status_code == 200
    assert "focus-visible" in updated.json()["content"]


def test_compose_style_context(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "compose-style-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=headers,
        json={"name": "Guide workspace", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]
    client.post(
        f"/api/v1/team/workspaces/{workspace_id}/style-guides",
        headers=headers,
        json={"title": "API conventions", "guide_type": "conventions", "content": "Prefer explicit error messages."},
    )

    context = projects_team_service.compose_style_context(user_id="compose-style-user", workspace_id=workspace_id)
    assert "API conventions" in context
    assert "explicit error messages" in context


def test_oidc_public_config_endpoint(client) -> None:
    response = client.get("/api/v1/auth/oidc/config")
    assert response.status_code == 200
    body = response.json()
    assert "enabled" in body
    assert "redirect_uri" in body
    assert "scopes" in body


def test_delegation_step_approval_gate(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "approval-gate-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    session = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": ".", "model_preference": "auto"},
    )
    session_id = session.json()["session_id"]

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=headers,
        json={"name": "Approval team", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]

    delegation = client.post(
        "/api/v1/team/delegations",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "session_id": session_id,
            "assigned_role": "reviewer",
            "task": "Review auth middleware and propose fixes",
            "priority": "normal",
            "orchestration_mode": "sequential",
            "agent_roles": ["reviewer", "implementer"],
            "require_step_approval": True,
        },
    )
    task_id = delegation.json()["task_id"]

    paused_steps = [
        {
            "step_index": 1,
            "role": "reviewer",
            "status": "completed",
            "output": "Review complete",
            "started_at": "2026-01-01T00:00:00+00:00",
            "completed_at": "2026-01-01T00:00:01+00:00",
        }
    ]

    with patch(
        "app.delegation_orchestrator.execute_delegation_chain",
        new_callable=AsyncMock,
        side_effect=[
            (paused_steps, "Awaiting approval", True),
            (
                paused_steps
                + [
                    {
                        "step_index": 2,
                        "role": "implementer",
                        "status": "completed",
                        "output": "Implemented",
                        "started_at": "2026-01-01T00:00:02+00:00",
                        "completed_at": "2026-01-01T00:00:03+00:00",
                    }
                ],
                "All steps complete",
                False,
            ),
        ],
    ):
        executed = client.post(f"/api/v1/team/delegations/{task_id}/execute", headers=headers)
        assert executed.status_code == 200
        assert executed.json()["status"] == "awaiting_approval"

        rejected = client.post(
            f"/api/v1/team/delegations/{task_id}/approve-step",
            headers=headers,
            json={"approved": False, "note": "Needs more detail"},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "failed"

        delegation = client.post(
            "/api/v1/team/delegations",
            headers=headers,
            json={
                "workspace_id": workspace_id,
                "session_id": session_id,
                "assigned_role": "reviewer",
                "task": "Second pass with approval",
                "priority": "normal",
                "orchestration_mode": "sequential",
                "agent_roles": ["reviewer", "implementer"],
                "require_step_approval": True,
            },
        )
        task_id = delegation.json()["task_id"]
        executed = client.post(f"/api/v1/team/delegations/{task_id}/execute", headers=headers)
        assert executed.json()["status"] == "awaiting_approval"

        approved = client.post(
            f"/api/v1/team/delegations/{task_id}/approve-step",
            headers=headers,
            json={"approved": True},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "completed"


def test_delegation_step_approval_requires_admin_role(client) -> None:
    init_db()
    owner_login = client.post("/api/v1/auth/dev-login", json={"user_id": "approval-owner"})
    owner_headers = {"Authorization": f"Bearer {owner_login.json()['access_token']}"}

    session = client.post(
        "/api/v1/sessions",
        headers=owner_headers,
        json={"project_path": ".", "model_preference": "auto"},
    )
    session_id = session.json()["session_id"]

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=owner_headers,
        json={"name": "Approval policy team", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]

    client.post(
        f"/api/v1/team/workspaces/{workspace_id}/members",
        headers=owner_headers,
        json={"user_id": "approval-member", "role": "member"},
    )

    delegation = client.post(
        "/api/v1/team/delegations",
        headers=owner_headers,
        json={
            "workspace_id": workspace_id,
            "session_id": session_id,
            "assigned_role": "reviewer",
            "task": "Needs admin approval",
            "priority": "normal",
            "orchestration_mode": "sequential",
            "agent_roles": ["reviewer", "implementer"],
            "require_step_approval": True,
        },
    )
    task_id = delegation.json()["task_id"]

    paused_steps = [
        {
            "step_index": 1,
            "role": "reviewer",
            "status": "completed",
            "output": "Review complete",
            "started_at": "2026-01-01T00:00:00+00:00",
            "completed_at": "2026-01-01T00:00:01+00:00",
        }
    ]

    with patch(
        "app.delegation_orchestrator.execute_delegation_chain",
        new_callable=AsyncMock,
        return_value=(paused_steps, "Awaiting approval", True),
    ):
        executed = client.post(f"/api/v1/team/delegations/{task_id}/execute", headers=owner_headers)
        assert executed.json()["status"] == "awaiting_approval"

    member_login = client.post("/api/v1/auth/dev-login", json={"user_id": "approval-member"})
    member_headers = {"Authorization": f"Bearer {member_login.json()['access_token']}"}

    denied = client.post(
        f"/api/v1/team/delegations/{task_id}/approve-step",
        headers=member_headers,
        json={"approved": True},
    )
    assert denied.status_code == 400
    assert "owners or admins" in denied.json()["detail"]


def test_multi_agent_delegation_create_payload(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "multi-agent-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    session = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": ".", "model_preference": "auto"},
    )
    session_id = session.json()["session_id"]

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=headers,
        json={"name": "Orchestration team", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]

    delegation = client.post(
        "/api/v1/team/delegations",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "session_id": session_id,
            "assigned_role": "reviewer",
            "task": "Review auth middleware and propose fixes",
            "priority": "normal",
            "orchestration_mode": "sequential",
            "agent_roles": ["reviewer", "implementer"],
        },
    )
    assert delegation.status_code == 200
    body = delegation.json()
    assert body["orchestration_mode"] == "sequential"
    assert body["agent_roles"] == ["reviewer", "implementer"]


@pytest.mark.asyncio
async def test_vision_ocr_fallback_without_litellm() -> None:
    from app.vision_ocr import extract_text_from_image_bytes

    with patch("app.vision_ocr.generation_client.generate", new_callable=AsyncMock) as mock_generate:
        mock_generate.return_value = {"text": "Fallback OCR text", "backend": "deterministic"}
        with patch("litellm.acompletion", side_effect=RuntimeError("vision unavailable")):
            result = await extract_text_from_image_bytes(b"fake-image", prompt="Read text")
    assert "Fallback OCR text" in result["text"]


def test_extract_structured_data_plain_text(tmp_path) -> None:
    init_db()
    sample = tmp_path / "notes.md"
    sample.write_text("Owner: Alice\nEmail: alice@example.com", encoding="utf-8")
    result = extract_structured_data(tmp_path.as_posix(), "notes.md")
    assert result["method"] == "plain_text"
    assert "Alice" in result["text_excerpt"]

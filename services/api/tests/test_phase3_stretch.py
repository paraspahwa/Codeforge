from __future__ import annotations

from app.artifacts import extract_artifacts_from_text, list_session_artifacts, render_artifact_preview
from app.db import init_db


def test_extract_artifacts_from_markdown_fences() -> None:
    init_db()
    saved = extract_artifacts_from_text(
        text=(
            "Here is a chart:\n"
            "```mermaid\n"
            "graph TD; A-->B;\n"
            "```\n"
            "And html:\n"
            "```html\n"
            "<h1>Hello</h1>\n"
            "```"
        ),
        session_id="sess_test",
        user_id="stretch-user",
        source_message_id="msg_test",
    )
    assert len(saved) == 2
    kinds = {item["kind"] for item in saved}
    assert kinds == {"mermaid", "html"}


def test_render_artifact_preview_wraps_mermaid() -> None:
    html = render_artifact_preview(
        {
            "title": "Diagram",
            "kind": "mermaid",
            "content": "graph TD; A-->B;",
        }
    )
    assert "mermaid" in html.lower()


def test_agent_template_compose_and_message(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "template-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/agent/templates",
        headers=headers,
        json={
            "name": "Reviewer",
            "description": "Review changes",
            "prompt_prefix": "You are a strict code reviewer. Focus on tests and security.",
            "verify_command": "pytest -q",
        },
    )
    assert created.status_code == 200
    template_id = created.json()["template_id"]

    composed = client.post(
        f"/api/v1/agent/templates/{template_id}/compose",
        headers=headers,
        json={"user_task": "Review auth middleware"},
    )
    assert composed.status_code == 200
    assert "Reviewer" in composed.json()["composed_prompt"] or "reviewer" in composed.json()["composed_prompt"].lower()

    session = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": ".", "model_preference": "auto"},
    )
    session_id = session.json()["session_id"]

    message = client.post(
        f"/api/v1/sessions/{session_id}/messages",
        headers=headers,
        json={
            "content": "Check login flow",
            "template_id": template_id,
        },
    )
    assert message.status_code == 200

    listed = client.get("/api/v1/agent/templates", headers=headers)
    assert listed.status_code == 200
    assert any(item["template_id"] == template_id for item in listed.json()["templates"])


def test_session_artifacts_api(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "artifact-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    session = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": ".", "model_preference": "auto"},
    )
    session_id = session.json()["session_id"]

    created = client.post(
        f"/api/v1/sessions/{session_id}/artifacts",
        headers=headers,
        json={
            "title": "Demo page",
            "kind": "html",
            "content": "<html><body><h1>Artifact</h1></body></html>",
        },
    )
    assert created.status_code == 200
    artifact_id = created.json()["artifact_id"]

    listed = client.get(f"/api/v1/sessions/{session_id}/artifacts", headers=headers)
    assert listed.status_code == 200
    assert any(item["artifact_id"] == artifact_id for item in listed.json()["artifacts"])

    preview = client.get(
        f"/api/v1/sessions/{session_id}/artifacts/{artifact_id}/preview",
        headers=headers,
    )
    assert preview.status_code == 200
    assert "Artifact" in preview.text

    artifacts = list_session_artifacts(session_id=session_id, user_id="artifact-user")
    assert len(artifacts) >= 1

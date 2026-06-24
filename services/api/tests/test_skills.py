from __future__ import annotations

from app.db import init_db
from app.skills_service import skills_service


ANTHROPIC_BUNDLED_SKILLS = (
    "frontend-design",
    "webapp-testing",
    "mcp-builder",
    "skill-creator",
    "doc-coauthoring",
)


def test_list_bundled_skills() -> None:
    skills = skills_service.list_skills()
    names = {item["name"] for item in skills}
    assert "caveman" in names
    assert "pr-conventions" in names
    for skill_name in ANTHROPIC_BUNDLED_SKILLS:
        assert skill_name in names
    assert "agent-reach" in names


def test_agent_reach_skill_attribution() -> None:
    skill = skills_service.load_skill("agent-reach")
    assert skill is not None
    assert "Agent-Reach" in skill.get("source", "")
    assert skill.get("license") == "MIT"
    assert "mcp_call" in skill["body"]


def test_anthropic_skills_have_attribution() -> None:
    for skill_name in ANTHROPIC_BUNDLED_SKILLS:
        skill = skills_service.load_skill(skill_name)
        assert skill is not None
        assert skill.get("source", "").startswith("https://github.com/anthropics/skills")
        assert skill.get("license") == "Apache-2.0"
        assert skill["body"].strip()


def test_caveman_mode_preferences_and_prompt_trigger(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "skills-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    update = client.put(
        "/api/v1/agent/preferences",
        headers=headers,
        json={"caveman_mode": "full", "enabled_skills": ["pr-conventions"]},
    )
    assert update.status_code == 200
    body = update.json()
    assert body["caveman_mode"] == "full"
    assert body["token_saver_enabled"] is True
    assert "pr-conventions" in body["enabled_skills"]

    instructions, meta = skills_service.compose_agent_instructions(
        user_id="skills-user",
        project_path=None,
        user_prompt="please use caveman mode and explain redis pooling",
    )
    assert meta["caveman_mode"] == "full"
    assert "caveman" in meta["active_skills"]
    assert "pr-conventions" in meta["active_skills"]
    assert "Respond terse like smart caveman" in instructions

    ephemeral, ephemeral_meta = skills_service.compose_agent_instructions(
        user_id="skills-user",
        project_path=None,
        user_prompt="stop caveman and explain normally",
    )
    assert ephemeral_meta["caveman_mode"] == "off"
    assert "caveman" not in ephemeral_meta["active_skills"]


def test_skills_api_list_and_detail(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "skills-api-user"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    listed = client.get("/api/v1/skills", headers=headers)
    assert listed.status_code == 200
    assert any(item["name"] == "caveman" for item in listed.json()["skills"])

    detail = client.get("/api/v1/skills/caveman", headers=headers)
    assert detail.status_code == 200
    assert "Respond terse like smart caveman" in detail.json()["body"]

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.delegation_orchestrator import execute_delegation_chain, parse_agent_roles
from app.projects_team import ProjectsTeamError


def test_parse_agent_roles_supervisor_input() -> None:
    roles = parse_agent_roles("lead", ["reviewer", "implementer"])
    assert roles == ["reviewer", "implementer"]


@pytest.mark.asyncio
async def test_execute_delegation_chain_pauses_for_approval() -> None:
    delegation = {"session_id": "sess_test", "assigned_role": "reviewer", "task": "Review auth flow"}
    mock_run = AsyncMock()
    mock_run.assistant_message = "Step one complete"

    with patch("app.delegation_orchestrator.build_agent_run", new=mock_run):
        steps, note, paused = await execute_delegation_chain(
            actor_id="user-1",
            delegation=delegation,
            project_path=".",
            orchestration_mode="sequential",
            agent_roles=["reviewer", "implementer"],
            require_step_approval=True,
        )

    assert paused is True
    assert len(steps) == 1
    assert steps[0]["status"] == "completed"
    assert "awaiting human approval" in note.lower()


@pytest.mark.asyncio
async def test_execute_delegation_chain_resumes_from_start_at() -> None:
    delegation = {"session_id": "sess_test", "assigned_role": "reviewer", "task": "Continue work"}
    prior_steps = [
        {
            "step_index": 1,
            "role": "reviewer",
            "status": "completed",
            "output": "Already reviewed",
            "started_at": "2026-01-01T00:00:00+00:00",
            "completed_at": "2026-01-01T00:00:01+00:00",
        }
    ]
    mock_run = AsyncMock()
    mock_run.assistant_message = "Implemented fixes"

    with patch("app.delegation_orchestrator.build_agent_run", new=mock_run):
        steps, note, paused = await execute_delegation_chain(
            actor_id="user-1",
            delegation=delegation,
            project_path=".",
            orchestration_mode="sequential",
            agent_roles=["reviewer", "implementer"],
            start_at=2,
            prior_steps=prior_steps,
        )

    assert paused is False
    assert len(steps) == 2
    assert steps[-1]["role"] == "implementer"
    assert "Completed 2 agent step(s)" in note


@pytest.mark.asyncio
async def test_execute_delegation_chain_failure_mid_chain() -> None:
    delegation = {"session_id": "sess_test", "assigned_role": "reviewer", "task": "Fail midway"}
    mock_run = AsyncMock(side_effect=RuntimeError("model unavailable"))

    with patch("app.delegation_orchestrator.build_agent_run", new=mock_run):
        with pytest.raises(ProjectsTeamError, match="failed"):
            await execute_delegation_chain(
                actor_id="user-1",
                delegation=delegation,
                project_path=".",
                orchestration_mode="sequential",
                agent_roles=["reviewer", "implementer"],
            )

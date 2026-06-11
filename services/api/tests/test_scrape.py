from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.db import init_db
from app.scrape_service import ScrapeError, scrape_enabled


def test_scrape_enabled_default() -> None:
    assert scrape_enabled() is True


def test_create_scrape_plan_requires_prompt(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "scrape-user"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    session = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": ".", "model_preference": "auto"},
    )
    session_id = session.json()["session_id"]

    missing_prompt = client.post(
        "/api/v1/cowork/plans",
        headers=headers,
        json={
            "session_id": session_id,
            "title": "Bad scrape",
            "task_type": "scrape",
            "url": "https://example.com",
        },
    )
    assert missing_prompt.status_code == 400


@patch("app.scrape_service.run_scrape_extraction", new_callable=AsyncMock)
def test_scrape_endpoint_runs_and_returns_result(mock_run, client) -> None:
    init_db()
    mock_run.return_value = {
        "status": "completed",
        "summary": "Scraped url source with scrapegraphai",
        "engine": "scrapegraphai",
        "source": "https://example.com",
        "source_kind": "url",
        "prompt": "Extract docs",
        "result": {"endpoints": ["/health"]},
        "text_excerpt": '{"endpoints": ["/health"]}',
        "warnings": [],
    }

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "scrape-api-user"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    session = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": ".", "model_preference": "auto"},
    )
    session_id = session.json()["session_id"]

    response = client.post(
        "/api/v1/cowork/scrape",
        headers=headers,
        json={
            "session_id": session_id,
            "scrape_prompt": "Extract API endpoints",
            "url": "https://example.com",
            "approved": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["engine"] == "scrapegraphai"
    assert "/health" in body["text_excerpt"]


def test_scrape_service_rejects_empty_prompt() -> None:
    import asyncio

    async def _run() -> None:
        from app.scrape_service import run_scrape_extraction

        try:
            await run_scrape_extraction(
                project_path=".",
                scrape_prompt="",
                url="https://example.com",
            )
        except ScrapeError as exc:
            assert "scrape_prompt" in str(exc)
        else:
            raise AssertionError("expected ScrapeError")

    asyncio.run(_run())

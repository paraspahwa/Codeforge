from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("CODEFORGE_ENV", "development")

from app import state  # noqa: E402
from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fast_local_test_env(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep pytest fast and offline: SQLite per test, no Supabase/OpenAI/Qdrant round-trips."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("PGHOST", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("CODEFORGE_EMBEDDING_MODEL", "")
    monkeypatch.delenv("QDRANT_URL", raising=False)
    # db.py snapshots DATABASE_URL at import; force SQLite even if shell inherited .env.local.
    monkeypatch.setattr("app.db.DATABASE_URL", "")

    db_file = tmp_path / "codeforge.db"
    monkeypatch.setattr("app.db.DB_PATH", db_file)

    # VectorStore is a process singleton; reset to in-memory deterministic mode.
    state.vector_store._client = None
    state.vector_store._backend = "memory"
    state.vector_store._memory_points = []
    state.vector_store._embedding_source = "deterministic"

    init_db()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("CODEFORGE_ENV", "development")

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client

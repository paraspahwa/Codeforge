from __future__ import annotations

from app.vector_store import target_vector_size


def test_target_vector_size_uses_explicit_config(monkeypatch) -> None:
    monkeypatch.setenv("QDRANT_VECTOR_SIZE", "768")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert target_vector_size() == 768


def test_target_vector_size_uses_openai_default(monkeypatch) -> None:
    monkeypatch.delenv("QDRANT_VECTOR_SIZE", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    assert target_vector_size() == 1536


def test_target_vector_size_falls_back_to_deterministic(monkeypatch) -> None:
    monkeypatch.delenv("QDRANT_VECTOR_SIZE", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert target_vector_size() == 64

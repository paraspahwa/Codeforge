from __future__ import annotations

import hashlib
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def target_vector_size() -> int:
    configured = os.getenv("QDRANT_VECTOR_SIZE", "").strip()
    if configured.isdigit():
        return max(1, int(configured))
    if os.getenv("OPENAI_API_KEY", "").strip():
        return 1536
    return 64


def _embed_text(text: str, dim: int | None = None) -> list[float]:
    if dim is None:
        dim = target_vector_size()
    """Deterministic lightweight embedding fallback to keep vector flow operational."""
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values = [b / 255.0 for b in digest]
    repeats = (dim + len(values) - 1) // len(values)
    expanded = (values * repeats)[:dim]
    return expanded


def _embed_text_real(text: str) -> list[float] | None:
    model_name = os.getenv("CODEFORGE_EMBEDDING_MODEL", "text-embedding-3-small").strip()
    if not model_name:
        return None

    # Try LiteLLM embedding first when the package is available.
    try:
        import litellm  # type: ignore

        response = litellm.embedding(model=model_name, input=[text])
        data = response.get("data") if isinstance(response, dict) else None
        if isinstance(data, list) and data:
            embedding = data[0].get("embedding") if isinstance(data[0], dict) else None
            if isinstance(embedding, list) and embedding:
                return [float(value) for value in embedding]
    except Exception:
        pass

    # Fall back to direct OpenAI-compatible embeddings API when configured.
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    timeout_seconds = float(os.getenv("CODEFORGE_SYNTHESIS_TIMEOUT_SECONDS", "8"))
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(
                f"{base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": model_name, "input": text},
            )
        if response.status_code >= 400:
            return None
        payload = response.json()
        data = payload.get("data")
        if isinstance(data, list) and data:
            embedding = data[0].get("embedding") if isinstance(data[0], dict) else None
            if isinstance(embedding, list) and embedding:
                return [float(value) for value in embedding]
    except Exception:
        return None

    return None


class VectorStore:
    """Qdrant-first vector store with local in-process fallback."""

    def __init__(self) -> None:
        self._url = os.getenv("QDRANT_URL", "http://localhost:6333")
        self._collection = os.getenv("QDRANT_COLLECTION", "codeforge-context")
        self._client = None
        self._backend = "memory"
        self._memory_points: list[dict[str, Any]] = []
        self._embedding_source = "deterministic"

        try:
            from qdrant_client import QdrantClient  # type: ignore
            from qdrant_client.http import models as qmodels  # type: ignore

            self._qmodels = qmodels
            self._client = QdrantClient(url=self._url)
            self._backend = "qdrant"
            self._ensure_collection()
        except ImportError:
            self._client = None
            self._backend = "memory"
            logger.info("qdrant not available, using in-memory vector store")
        except Exception as exc:
            self._client = None
            self._backend = "memory"
            logger.warning("qdrant connection failed: %s", exc)

    @property
    def backend(self) -> str:
        return self._backend

    @property
    def embedding_source(self) -> str:
        return self._embedding_source

    def _embed(self, text: str) -> list[float]:
        real = _embed_text_real(text)
        if real:
            self._embedding_source = "real"
            return real
        self._embedding_source = "deterministic"
        return _embed_text(text)

    def ping(self) -> bool:
        if self._client is None:
            return True
        try:
            self._client.get_collections()
            return True
        except Exception:
            return False

    def _ensure_collection(self) -> None:
        if self._client is None:
            return
        vector_size = target_vector_size()
        try:
            info = self._client.get_collection(collection_name=self._collection)
            existing_size = info.config.params.vectors.size
            if existing_size != vector_size:
                self._client.delete_collection(collection_name=self._collection)
                raise RuntimeError("collection vector size mismatch")
        except Exception:
            self._client.create_collection(
                collection_name=self._collection,
                vectors_config=self._qmodels.VectorParams(
                    size=vector_size,
                    distance=self._qmodels.Distance.COSINE,
                ),
            )

    def upsert_text(self, item_id: str, text: str, metadata: dict[str, Any] | None = None) -> None:
        vector = self._embed(text)
        payload = metadata or {}

        if self._client is not None:
            try:
                self._client.upsert(
                    collection_name=self._collection,
                    points=[
                        self._qmodels.PointStruct(
                            id=item_id,
                            vector=vector,
                            payload={"text": text, **payload},
                        )
                    ],
                )
                return
            except Exception:
                pass

        self._memory_points = [p for p in self._memory_points if p["id"] != item_id]
        self._memory_points.append({"id": item_id, "vector": vector, "payload": {"text": text, **payload}})

    def search_text(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        query_vector = self._embed(query)

        if self._client is not None:
            try:
                results = self._client.search(
                    collection_name=self._collection,
                    query_vector=query_vector,
                    limit=max(1, min(limit, 20)),
                )
                return [
                    {
                        "id": str(item.id),
                        "score": float(item.score),
                        "payload": item.payload or {},
                    }
                    for item in results
                ]
            except Exception:
                pass

        # Lightweight in-memory cosine-ish ranking via dot product.
        scored: list[tuple[float, dict[str, Any]]] = []
        for point in self._memory_points:
            score = sum(a * b for a, b in zip(query_vector, point["vector"]))
            scored.append((score, point))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            {
                "id": str(point["id"]),
                "score": float(score),
                "payload": point["payload"],
            }
            for score, point in scored[: max(1, min(limit, 20))]
        ]

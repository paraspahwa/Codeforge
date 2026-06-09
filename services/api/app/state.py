from __future__ import annotations

import os

from .cache import RedisSessionStore
from .model_router import GenerationClient
from .task_queue import TaskQueue
from .vector_store import VectorStore

redis_session_store = RedisSessionStore()
vector_store = VectorStore()
task_queue = TaskQueue()
generation_client = GenerationClient()

RATE_LIMIT_PER_MINUTE = int(os.getenv("CODEFORGE_RATE_LIMIT_PER_MINUTE", "60"))

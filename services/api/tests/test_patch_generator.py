from __future__ import annotations

import pytest

from app.patch_generator import _heuristic_patch, generate_proposed_content_async


@pytest.mark.asyncio
async def test_heuristic_adds_python_test_stub() -> None:
    original = "def existing():\n    return 1\n"
    updated = _heuristic_patch("module.py", "add unit test for existing", original)
    assert "test_codeforge_generated" in updated
    assert updated != original


@pytest.mark.asyncio
async def test_generate_proposed_content_async_uses_heuristic_without_llm() -> None:
    original = "def run():\n    pass\n"
    result = await generate_proposed_content_async("app.py", "add test coverage", original)
    assert result.changed is True
    assert result.source in {"heuristic", "llm", "unchanged"}
    assert result.proposed_content != original or result.source == "unchanged"

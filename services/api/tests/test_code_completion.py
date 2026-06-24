from __future__ import annotations

import pytest

from app.code_completion import suggest_code_completion


@pytest.mark.asyncio
async def test_code_completion_heuristic_import() -> None:
    result = await suggest_code_completion(
        relative_path="main.py",
        content="import \n",
        line_number=1,
        column=8,
    )
    assert result["completion"]
    assert result["source"] == "heuristic"


@pytest.mark.asyncio
async def test_code_completion_empty_prefix() -> None:
    result = await suggest_code_completion(
        relative_path="app.ts",
        content="",
        line_number=1,
        column=1,
    )
    assert result["completion"] == ""
    assert result["source"] == "none"

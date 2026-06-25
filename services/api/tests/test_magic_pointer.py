from __future__ import annotations

from app.magic_pointer import compose_active_cursor_context, detect_entities


def test_compose_active_cursor_context_with_selection() -> None:
    block = compose_active_cursor_context(
        file_path="src/auth.ts",
        line_number=12,
        selection_start_line=10,
        selection_end_line=14,
        selection_text='const login = () => { return true; }',
        surrounding_context="  9| // auth\n> 10| const login = () => {",
    )
    assert "[ACTIVE_CURSOR_CONTEXT]" in block
    assert "File: src/auth.ts" in block
    assert "Selected Text:" in block
    assert "const login" in block
    assert "[/ACTIVE_CURSOR_CONTEXT]" in block


def test_detect_api_route_entity() -> None:
    entities = detect_entities('@app.post("/api/v1/auth/login")')
    assert any(item.kind == "api_route" for item in entities)


def test_deictic_instruction_included() -> None:
    block = compose_active_cursor_context(
        file_path="app.py",
        cursor_line_text="def handler(): pass",
    )
    assert "this" in block.lower()
    assert "Deictic" in block

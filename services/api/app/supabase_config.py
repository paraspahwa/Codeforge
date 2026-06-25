"""Supabase Auth configuration helpers."""

from __future__ import annotations

import os


def supabase_auth_configured() -> bool:
    return bool(
        os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").strip()
        and os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()
        and os.getenv("SUPABASE_JWT_SECRET", "").strip()
    )

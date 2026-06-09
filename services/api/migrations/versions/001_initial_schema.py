"""Initial schema bootstrap via existing init_db helper."""

from __future__ import annotations

from alembic import op

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.db import init_db

    init_db()


def downgrade() -> None:
    # Non-destructive bootstrap migration; downgrade is intentionally a no-op.
    _ = op

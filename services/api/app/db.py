import os
import sqlite3
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row

DB_PATH = Path(__file__).resolve().parent.parent / "codeforge.db"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def _is_postgres() -> bool:
    return DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")


def _sqlite_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _pg_connection() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def _execute(statement: str, params: tuple[Any, ...] = ()) -> None:
    if _is_postgres():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(statement.replace("?", "%s"), params)
    else:
        conn = _sqlite_connection()
        try:
            conn.execute(statement, params)
            conn.commit()
        finally:
            conn.close()


def _fetchone(statement: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    if _is_postgres():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(statement.replace("?", "%s"), params)
                row = cur.fetchone()
                return dict(row) if row else None
    conn = _sqlite_connection()
    try:
        row = conn.execute(statement, params).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def _fetchall(statement: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    if _is_postgres():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(statement.replace("?", "%s"), params)
                rows = cur.fetchall()
                return [dict(row) for row in rows]
    conn = _sqlite_connection()
    try:
        rows = conn.execute(statement, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def init_db() -> None:
    if _is_postgres():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS sessions (
                        session_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        project_path TEXT NOT NULL,
                        model_preference TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS messages (
                        message_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL REFERENCES sessions(session_id),
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        context_json TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS usage_logs (
                        usage_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        session_id TEXT NOT NULL REFERENCES sessions(session_id),
                        model_used TEXT NOT NULL,
                        input_tokens INTEGER NOT NULL,
                        output_tokens INTEGER NOT NULL,
                        cost_usd DOUBLE PRECISION NOT NULL,
                        latency_ms INTEGER NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS billing_orders (
                        order_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        plan_id TEXT NOT NULL,
                        amount_inr INTEGER NOT NULL,
                        currency TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS billing_webhooks (
                        event_id TEXT PRIMARY KEY,
                        event_type TEXT NOT NULL,
                        payload_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS user_subscriptions (
                        user_id TEXT PRIMARY KEY,
                        plan_id TEXT NOT NULL,
                        status TEXT NOT NULL,
                        amount_inr INTEGER,
                        order_id TEXT,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS agent_proposals (
                        proposal_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL REFERENCES sessions(session_id),
                        user_id TEXT NOT NULL,
                        target_file TEXT NOT NULL,
                        prompt TEXT NOT NULL,
                        original_content TEXT NOT NULL,
                        proposed_content TEXT NOT NULL,
                        patch_preview TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        resolved_at TEXT,
                        resolution_note TEXT
                    )
                    """
                )
        return

    conn = _sqlite_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                project_path TEXT NOT NULL,
                model_preference TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                message_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                context_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions (session_id)
            );

            CREATE TABLE IF NOT EXISTS usage_logs (
                usage_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                model_used TEXT NOT NULL,
                input_tokens INTEGER NOT NULL,
                output_tokens INTEGER NOT NULL,
                cost_usd REAL NOT NULL,
                latency_ms INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions (session_id)
            );

            CREATE TABLE IF NOT EXISTS billing_orders (
                order_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                plan_id TEXT NOT NULL,
                amount_inr INTEGER NOT NULL,
                currency TEXT NOT NULL,
                provider TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS billing_webhooks (
                event_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_subscriptions (
                user_id TEXT PRIMARY KEY,
                plan_id TEXT NOT NULL,
                status TEXT NOT NULL,
                amount_inr INTEGER,
                order_id TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_proposals (
                proposal_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                target_file TEXT NOT NULL,
                prompt TEXT NOT NULL,
                original_content TEXT NOT NULL,
                proposed_content TEXT NOT NULL,
                patch_preview TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                resolution_note TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions (session_id)
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


def insert_session(session_id: str, user_id: str, project_path: str, model_preference: str, created_at: str) -> None:
    _execute(
        "INSERT INTO sessions(session_id, user_id, project_path, model_preference, created_at) VALUES (?, ?, ?, ?, ?)",
        (session_id, user_id, project_path, model_preference, created_at),
    )


def get_session_for_user(session_id: str, user_id: str) -> dict[str, Any] | None:
    return _fetchone(
        "SELECT session_id, user_id, project_path, model_preference, created_at FROM sessions WHERE session_id = ? AND user_id = ?",
        (session_id, user_id),
    )


def list_sessions_for_user(user_id: str) -> list[dict[str, Any]]:
    return _fetchall(
        "SELECT session_id, project_path, model_preference, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    )


def insert_message(
    message_id: str,
    session_id: str,
    role: str,
    content: str,
    context_json: str | None,
    created_at: str,
) -> None:
    _execute(
        "INSERT INTO messages(message_id, session_id, role, content, context_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (message_id, session_id, role, content, context_json, created_at),
    )


def list_messages_for_session(session_id: str) -> list[dict[str, Any]]:
    return _fetchall(
        "SELECT message_id, role, content, context_json, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    )


def latest_user_message(session_id: str) -> str:
    row = _fetchone(
        "SELECT content FROM messages WHERE session_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1",
        (session_id,),
    )
    return row["content"] if row else ""


def insert_usage_log(
    usage_id: str,
    user_id: str,
    session_id: str,
    model_used: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    latency_ms: int,
    created_at: str,
) -> None:
    _execute(
        """
        INSERT INTO usage_logs(
            usage_id, user_id, session_id, model_used, input_tokens,
            output_tokens, cost_usd, latency_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            usage_id,
            user_id,
            session_id,
            model_used,
            input_tokens,
            output_tokens,
            cost_usd,
            latency_ms,
            created_at,
        ),
    )


def get_usage_summary_for_user(user_id: str) -> dict[str, Any]:
    row = _fetchone(
        """
        SELECT
          COUNT(*) AS total_requests,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
          COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
        FROM usage_logs
        WHERE user_id = ?
        """,
        (user_id,),
    )
    if row is None:
        return {
            "total_requests": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_cost_usd": 0.0,
            "avg_latency_ms": 0.0,
        }
    return {
        "total_requests": int(row["total_requests"]),
        "input_tokens": int(row["input_tokens"]),
        "output_tokens": int(row["output_tokens"]),
        "total_cost_usd": float(row["total_cost_usd"]),
        "avg_latency_ms": float(row["avg_latency_ms"]),
    }


def insert_billing_order(
    order_id: str,
    user_id: str,
    plan_id: str,
    amount_inr: int,
    currency: str,
    provider: str,
    status: str,
    created_at: str,
) -> None:
    _execute(
        """
        INSERT INTO billing_orders(order_id, user_id, plan_id, amount_inr, currency, provider, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (order_id, user_id, plan_id, amount_inr, currency, provider, status, created_at),
    )


def insert_billing_webhook(event_id: str, event_type: str, payload_json: str, created_at: str) -> None:
    _execute(
        "INSERT INTO billing_webhooks(event_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)",
        (event_id, event_type, payload_json, created_at),
    )


def update_billing_order_status(order_id: str, status: str) -> None:
    _execute(
        "UPDATE billing_orders SET status = ? WHERE order_id = ?",
        (status, order_id),
    )


def upsert_user_subscription(
    user_id: str,
    plan_id: str,
    status: str,
    amount_inr: int | None,
    order_id: str | None,
    updated_at: str,
) -> None:
    if _is_postgres():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_subscriptions(user_id, plan_id, status, amount_inr, order_id, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET
                        plan_id = EXCLUDED.plan_id,
                        status = EXCLUDED.status,
                        amount_inr = EXCLUDED.amount_inr,
                        order_id = EXCLUDED.order_id,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (user_id, plan_id, status, amount_inr, order_id, updated_at),
                )
        return

    conn = _sqlite_connection()
    try:
        conn.execute(
            """
            INSERT INTO user_subscriptions(user_id, plan_id, status, amount_inr, order_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                plan_id = excluded.plan_id,
                status = excluded.status,
                amount_inr = excluded.amount_inr,
                order_id = excluded.order_id,
                updated_at = excluded.updated_at
            """,
            (user_id, plan_id, status, amount_inr, order_id, updated_at),
        )
        conn.commit()
    finally:
        conn.close()


def get_user_subscription(user_id: str) -> dict[str, Any] | None:
    return _fetchone(
        "SELECT user_id, plan_id, status, amount_inr, order_id, updated_at FROM user_subscriptions WHERE user_id = ?",
        (user_id,),
    )


def insert_agent_proposal(
    proposal_id: str,
    session_id: str,
    user_id: str,
    target_file: str,
    prompt: str,
    original_content: str,
    proposed_content: str,
    patch_preview: str,
    status: str,
    created_at: str,
) -> None:
    _execute(
        """
        INSERT INTO agent_proposals(
            proposal_id, session_id, user_id, target_file, prompt, original_content,
            proposed_content, patch_preview, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            proposal_id,
            session_id,
            user_id,
            target_file,
            prompt,
            original_content,
            proposed_content,
            patch_preview,
            status,
            created_at,
        ),
    )


def get_agent_proposal_for_user(proposal_id: str, session_id: str, user_id: str) -> dict[str, Any] | None:
    return _fetchone(
        """
        SELECT proposal_id, session_id, user_id, target_file, prompt, original_content, proposed_content,
               patch_preview, status, created_at, resolved_at, resolution_note
        FROM agent_proposals
        WHERE proposal_id = ? AND session_id = ? AND user_id = ?
        """,
        (proposal_id, session_id, user_id),
    )


def update_agent_proposal_status(
    proposal_id: str,
    status: str,
    resolved_at: str,
    resolution_note: str | None = None,
) -> None:
    _execute(
        """
        UPDATE agent_proposals
        SET status = ?, resolved_at = ?, resolution_note = ?
        WHERE proposal_id = ?
        """,
        (status, resolved_at, resolution_note, proposal_id),
    )

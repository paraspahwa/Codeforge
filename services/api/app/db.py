import os
import sqlite3
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row

DB_PATH = Path(__file__).resolve().parent.parent / "codeforge.db"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

INDEX_STATEMENTS = (
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON sessions(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_usage_logs_session ON usage_logs(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_billing_orders_user ON billing_orders(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_agent_proposals_session ON agent_proposals(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_agent_proposals_user ON agent_proposals(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_benchmark_runs_suite_created ON routing_benchmark_runs(suite, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_cowork_snapshots_created ON cowork_reliability_snapshots(created_at)",
)


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
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS routing_benchmark_baselines (
                        suite TEXT PRIMARY KEY,
                        pass_rate DOUBLE PRECISION NOT NULL,
                        fallback_usage_rate DOUBLE PRECISION NOT NULL,
                        low_confidence_rate DOUBLE PRECISION NOT NULL,
                        total_estimated_cost_usd DOUBLE PRECISION NOT NULL,
                        updated_at TEXT NOT NULL,
                        updated_by TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS routing_benchmark_runs (
                        run_id TEXT PRIMARY KEY,
                        suite TEXT NOT NULL,
                        total_cases INTEGER NOT NULL,
                        passed_cases INTEGER NOT NULL,
                        pass_rate DOUBLE PRECISION NOT NULL,
                        fallback_usage_rate DOUBLE PRECISION NOT NULL,
                        low_confidence_rate DOUBLE PRECISION NOT NULL,
                        total_estimated_cost_usd DOUBLE PRECISION NOT NULL,
                        regression_alert BOOLEAN NOT NULL,
                        regression_reason TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS cowork_reliability_snapshots (
                        snapshot_id TEXT PRIMARY KEY,
                        max_concurrent_runs INTEGER NOT NULL,
                        running_jobs INTEGER NOT NULL,
                        total_jobs INTEGER NOT NULL,
                        enabled_jobs INTEGER NOT NULL,
                        circuit_broken_jobs INTEGER NOT NULL,
                        recent_runs INTEGER NOT NULL,
                        recent_failed_runs INTEGER NOT NULL,
                        recent_failure_rate DOUBLE PRECISION NOT NULL,
                        reliability_alert BOOLEAN NOT NULL,
                        alert_reason TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                for statement in INDEX_STATEMENTS:
                    cur.execute(statement)
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

            CREATE TABLE IF NOT EXISTS routing_benchmark_baselines (
                suite TEXT PRIMARY KEY,
                pass_rate REAL NOT NULL,
                fallback_usage_rate REAL NOT NULL,
                low_confidence_rate REAL NOT NULL,
                total_estimated_cost_usd REAL NOT NULL,
                updated_at TEXT NOT NULL,
                updated_by TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS routing_benchmark_runs (
                run_id TEXT PRIMARY KEY,
                suite TEXT NOT NULL,
                total_cases INTEGER NOT NULL,
                passed_cases INTEGER NOT NULL,
                pass_rate REAL NOT NULL,
                fallback_usage_rate REAL NOT NULL,
                low_confidence_rate REAL NOT NULL,
                total_estimated_cost_usd REAL NOT NULL,
                regression_alert INTEGER NOT NULL,
                regression_reason TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cowork_reliability_snapshots (
                snapshot_id TEXT PRIMARY KEY,
                max_concurrent_runs INTEGER NOT NULL,
                running_jobs INTEGER NOT NULL,
                total_jobs INTEGER NOT NULL,
                enabled_jobs INTEGER NOT NULL,
                circuit_broken_jobs INTEGER NOT NULL,
                recent_runs INTEGER NOT NULL,
                recent_failed_runs INTEGER NOT NULL,
                recent_failure_rate REAL NOT NULL,
                reliability_alert INTEGER NOT NULL,
                alert_reason TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        for statement in INDEX_STATEMENTS:
            conn.execute(statement)
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


def list_sessions_for_user(user_id: str, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))
    return _fetchall(
        "SELECT session_id, project_path, model_preference, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (user_id, limit, offset),
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


def list_messages_for_session(session_id: str, limit: int = 500, offset: int = 0) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 1000))
    offset = max(0, int(offset))
    return _fetchall(
        "SELECT message_id, role, content, context_json, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
        (session_id, limit, offset),
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


def get_usage_count_for_user_since(user_id: str, since_iso: str) -> int:
    row = _fetchone(
        """
        SELECT COUNT(*) AS total_requests
        FROM usage_logs
        WHERE user_id = ? AND created_at >= ?
        """,
        (user_id, since_iso),
    )
    if row is None:
        return 0
    return int(row["total_requests"])


def get_usage_summary_for_user(user_id: str, since_iso: str | None = None) -> dict[str, Any]:
    if since_iso:
        row = _fetchone(
            """
            SELECT
              COUNT(*) AS total_requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
              COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
            FROM usage_logs
            WHERE user_id = ? AND created_at >= ?
            """,
            (user_id, since_iso),
        )
    else:
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


def get_billing_webhook(event_id: str) -> dict[str, Any] | None:
    return _fetchone(
        "SELECT event_id, event_type, created_at FROM billing_webhooks WHERE event_id = ?",
        (event_id,),
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


def list_agent_proposals_for_session(
    session_id: str,
    user_id: str,
    *,
    limit: int = 50,
) -> list[dict[str, Any]]:
    return _fetchall(
        """
        SELECT proposal_id, session_id, user_id, target_file, prompt, patch_preview,
               status, created_at, resolved_at
        FROM agent_proposals
        WHERE session_id = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (session_id, user_id, limit),
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


def upsert_routing_benchmark_baseline(
    *,
    suite: str,
    pass_rate: float,
    fallback_usage_rate: float,
    low_confidence_rate: float,
    total_estimated_cost_usd: float,
    updated_at: str,
    updated_by: str,
) -> None:
    if _is_postgres():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO routing_benchmark_baselines(
                        suite, pass_rate, fallback_usage_rate, low_confidence_rate,
                        total_estimated_cost_usd, updated_at, updated_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (suite) DO UPDATE SET
                        pass_rate = EXCLUDED.pass_rate,
                        fallback_usage_rate = EXCLUDED.fallback_usage_rate,
                        low_confidence_rate = EXCLUDED.low_confidence_rate,
                        total_estimated_cost_usd = EXCLUDED.total_estimated_cost_usd,
                        updated_at = EXCLUDED.updated_at,
                        updated_by = EXCLUDED.updated_by
                    """,
                    (
                        suite,
                        pass_rate,
                        fallback_usage_rate,
                        low_confidence_rate,
                        total_estimated_cost_usd,
                        updated_at,
                        updated_by,
                    ),
                )
        return

    conn = _sqlite_connection()
    try:
        conn.execute(
            """
            INSERT INTO routing_benchmark_baselines(
                suite, pass_rate, fallback_usage_rate, low_confidence_rate,
                total_estimated_cost_usd, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(suite) DO UPDATE SET
                pass_rate = excluded.pass_rate,
                fallback_usage_rate = excluded.fallback_usage_rate,
                low_confidence_rate = excluded.low_confidence_rate,
                total_estimated_cost_usd = excluded.total_estimated_cost_usd,
                updated_at = excluded.updated_at,
                updated_by = excluded.updated_by
            """,
            (
                suite,
                pass_rate,
                fallback_usage_rate,
                low_confidence_rate,
                total_estimated_cost_usd,
                updated_at,
                updated_by,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_routing_benchmark_baseline(suite: str) -> dict[str, Any] | None:
    return _fetchone(
        """
        SELECT suite, pass_rate, fallback_usage_rate, low_confidence_rate,
               total_estimated_cost_usd, updated_at, updated_by
        FROM routing_benchmark_baselines
        WHERE suite = ?
        """,
        (suite,),
    )


def insert_routing_benchmark_run(
    *,
    run_id: str,
    suite: str,
    total_cases: int,
    passed_cases: int,
    pass_rate: float,
    fallback_usage_rate: float,
    low_confidence_rate: float,
    total_estimated_cost_usd: float,
    regression_alert: bool,
    regression_reason: str,
    created_at: str,
) -> None:
    _execute(
        """
        INSERT INTO routing_benchmark_runs(
            run_id, suite, total_cases, passed_cases, pass_rate,
            fallback_usage_rate, low_confidence_rate, total_estimated_cost_usd,
            regression_alert, regression_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            suite,
            total_cases,
            passed_cases,
            pass_rate,
            fallback_usage_rate,
            low_confidence_rate,
            total_estimated_cost_usd,
            regression_alert,
            regression_reason,
            created_at,
        ),
    )


def list_routing_benchmark_runs(suite: str, limit: int = 20) -> list[dict[str, Any]]:
    safe_limit = max(1, min(limit, 100))
    query = (
        """
        SELECT run_id, suite, total_cases, passed_cases, pass_rate,
               fallback_usage_rate, low_confidence_rate, total_estimated_cost_usd,
               regression_alert, regression_reason, created_at
        FROM routing_benchmark_runs
        WHERE suite = ?
        ORDER BY created_at DESC
        LIMIT ?
        """
    )
    rows = _fetchall(query, (suite, safe_limit))
    for row in rows:
        row["regression_alert"] = bool(row.get("regression_alert", 0))
    return rows


def latest_routing_benchmark_run(suite: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT run_id, suite, total_cases, passed_cases, pass_rate,
               fallback_usage_rate, low_confidence_rate, total_estimated_cost_usd,
               regression_alert, regression_reason, created_at
        FROM routing_benchmark_runs
        WHERE suite = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (suite,),
    )
    if row:
        row["regression_alert"] = bool(row.get("regression_alert", 0))
    return row


def insert_cowork_reliability_snapshot(
    *,
    snapshot_id: str,
    max_concurrent_runs: int,
    running_jobs: int,
    total_jobs: int,
    enabled_jobs: int,
    circuit_broken_jobs: int,
    recent_runs: int,
    recent_failed_runs: int,
    recent_failure_rate: float,
    reliability_alert: bool,
    alert_reason: str,
    created_at: str,
) -> None:
    _execute(
        """
        INSERT INTO cowork_reliability_snapshots(
            snapshot_id, max_concurrent_runs, running_jobs, total_jobs,
            enabled_jobs, circuit_broken_jobs, recent_runs, recent_failed_runs,
            recent_failure_rate, reliability_alert, alert_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            snapshot_id,
            max_concurrent_runs,
            running_jobs,
            total_jobs,
            enabled_jobs,
            circuit_broken_jobs,
            recent_runs,
            recent_failed_runs,
            recent_failure_rate,
            reliability_alert,
            alert_reason,
            created_at,
        ),
    )


def list_cowork_reliability_snapshots(limit: int = 50) -> list[dict[str, Any]]:
    safe_limit = max(1, min(limit, 500))
    rows = _fetchall(
        """
        SELECT snapshot_id, max_concurrent_runs, running_jobs, total_jobs,
               enabled_jobs, circuit_broken_jobs, recent_runs, recent_failed_runs,
               recent_failure_rate, reliability_alert, alert_reason, created_at
        FROM cowork_reliability_snapshots
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (safe_limit,),
    )
    for row in rows:
        row["reliability_alert"] = bool(row.get("reliability_alert", 0))
    return rows

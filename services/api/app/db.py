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
    "CREATE INDEX IF NOT EXISTS idx_session_file_plans_session ON session_file_plans(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_benchmark_runs_suite_created ON routing_benchmark_runs(suite, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_cowork_snapshots_created ON cowork_reliability_snapshots(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_cowork_plans_user ON cowork_plans(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_cowork_runs_user ON cowork_runs(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_cowork_jobs_enabled ON cowork_jobs(enabled, circuit_broken)",
    "CREATE INDEX IF NOT EXISTS idx_project_knowledge_session ON project_knowledge(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_team_workspaces_owner ON team_workspaces(owner_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_workspace_members(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_session_shares_session ON session_shares(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_team_delegations_workspace ON team_delegations(workspace_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON audit_logs(workspace_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_session_created ON audit_logs(session_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_session_artifacts_session ON session_artifacts(session_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_agent_templates_user ON agent_templates(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_workspace_session_grants_lookup ON workspace_session_grants(workspace_id, session_id, granted_to_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_remote_channels_owner ON remote_channels(owner_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_team_style_guides_workspace ON team_style_guides(workspace_id, updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_taste_events_user_created ON taste_events(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_taste_rules_user_weight ON taste_rules(user_id, weight)",
    "CREATE INDEX IF NOT EXISTS idx_user_agent_preferences_user ON user_agent_preferences(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_agent_memories_user_created ON agent_memories(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_agent_memories_project ON agent_memories(project_id, created_at)",
)


def _is_postgres() -> bool:
    if os.getenv("PGHOST", "").strip():
        return True
    return DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")


def _sqlite_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _pg_connection() -> psycopg.Connection:
    if os.getenv("PGHOST", "").strip():
        return psycopg.connect(row_factory=dict_row)
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def _execute(statement: str, params: tuple[Any, ...] = ()) -> None:
    if _is_postgres():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(statement.replace("?", "%s"), params)
            conn.commit()
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
                        created_at TEXT NOT NULL,
                        org_id TEXT
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
                    CREATE TABLE IF NOT EXISTS session_file_plans (
                        plan_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL REFERENCES sessions(session_id),
                        user_id TEXT NOT NULL,
                        targets_json TEXT NOT NULL,
                        snapshot_json TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        executed_at TEXT
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
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS cowork_plans (
                        plan_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        project_path TEXT NOT NULL,
                        title TEXT NOT NULL,
                        task_type TEXT NOT NULL,
                        command TEXT,
                        source_path TEXT,
                        url TEXT,
                        browser_action TEXT,
                        connector_id TEXT,
                        tool_name TEXT,
                        connector_arguments_json TEXT,
                        requires_approval INTEGER NOT NULL,
                        preview_steps_json TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS cowork_runs (
                        run_id TEXT PRIMARY KEY,
                        plan_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        task_type TEXT NOT NULL,
                        status TEXT NOT NULL,
                        summary TEXT NOT NULL,
                        details_json TEXT NOT NULL,
                        trigger_type TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        completed_at TEXT
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS cowork_jobs (
                        job_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        project_path TEXT NOT NULL,
                        title TEXT NOT NULL,
                        trigger_type TEXT NOT NULL,
                        interval_seconds INTEGER NOT NULL,
                        watch_path TEXT,
                        watch_absolute TEXT,
                        watch_mtime DOUBLE PRECISION,
                        task_type TEXT NOT NULL,
                        command TEXT,
                        source_path TEXT,
                        url TEXT,
                        browser_action TEXT,
                        enabled INTEGER NOT NULL,
                        consecutive_failures INTEGER NOT NULL,
                        circuit_broken INTEGER NOT NULL,
                        circuit_broken_reason TEXT,
                        next_run_at TEXT,
                        last_run_at TEXT,
                        last_status TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS cowork_extractions (
                        extraction_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        source_path TEXT NOT NULL,
                        method TEXT NOT NULL,
                        byte_size INTEGER NOT NULL,
                        text_excerpt TEXT NOT NULL,
                        entities_json TEXT NOT NULL,
                        warnings_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS project_knowledge (
                        knowledge_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL UNIQUE,
                        user_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        project_path TEXT NOT NULL,
                        summary TEXT NOT NULL,
                        items_json TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS team_workspaces (
                        workspace_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL,
                        owner_id TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS team_workspace_members (
                        workspace_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        added_at TEXT NOT NULL,
                        PRIMARY KEY (workspace_id, user_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS session_shares (
                        share_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        owner_id TEXT NOT NULL,
                        access_level TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS team_delegations (
                        task_id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        requester_id TEXT NOT NULL,
                        assigned_role TEXT NOT NULL,
                        task TEXT NOT NULL,
                        priority TEXT NOT NULL,
                        status TEXT NOT NULL,
                        note TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        completed_at TEXT
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        event_id TEXT PRIMARY KEY,
                        actor_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        resource_type TEXT NOT NULL,
                        resource_id TEXT NOT NULL,
                        workspace_id TEXT,
                        session_id TEXT,
                        metadata_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS session_artifacts (
                        artifact_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        kind TEXT NOT NULL,
                        content TEXT NOT NULL,
                        source_message_id TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS agent_templates (
                        template_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL,
                        prompt_prefix TEXT NOT NULL,
                        verify_command TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS remote_channels (
                        channel_id TEXT PRIMARY KEY,
                        owner_id TEXT NOT NULL,
                        label TEXT NOT NULL,
                        pairing_code TEXT NOT NULL UNIQUE,
                        paired_client_id TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS team_style_guides (
                        guide_id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        guide_type TEXT NOT NULL,
                        content TEXT NOT NULL,
                        updated_by TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS organizations (
                        org_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        owner_id TEXT NOT NULL,
                        plan_id TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS organization_members (
                        org_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        added_at TEXT NOT NULL,
                        PRIMARY KEY (org_id, user_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS workspace_session_grants (
                        grant_id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        granted_to_user_id TEXT NOT NULL,
                        granted_by TEXT NOT NULL,
                        access_level TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS taste_events (
                        event_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        proposal_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        target_file TEXT NOT NULL,
                        project_path TEXT,
                        signal_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS taste_rules (
                        rule_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        scope TEXT NOT NULL,
                        project_path TEXT,
                        rule_text TEXT NOT NULL,
                        weight INTEGER NOT NULL,
                        source_event_id TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS user_agent_preferences (
                        user_id TEXT PRIMARY KEY,
                        caveman_mode TEXT NOT NULL DEFAULT 'off',
                        enabled_skills_json TEXT NOT NULL DEFAULT '[]',
                        rtk_enabled INTEGER NOT NULL DEFAULT 0,
                        rtk_last_stats_json TEXT NOT NULL DEFAULT '{}',
                        agent_engine TEXT NOT NULL DEFAULT 'codeforge',
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS agent_memories (
                        memory_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        project_id TEXT NOT NULL,
                        scope TEXT NOT NULL,
                        kind TEXT NOT NULL,
                        content TEXT NOT NULL,
                        content_hash TEXT NOT NULL,
                        source_session_id TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
            conn.commit()
            _migrate_optional_columns()
            with conn.cursor() as cur:
                for statement in INDEX_STATEMENTS:
                    try:
                        cur.execute(statement)
                    except Exception:
                        pass
            conn.commit()
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
                created_at TEXT NOT NULL,
                org_id TEXT
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

            CREATE TABLE IF NOT EXISTS session_file_plans (
                plan_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                targets_json TEXT NOT NULL,
                snapshot_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                executed_at TEXT,
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

            CREATE TABLE IF NOT EXISTS cowork_plans (
                plan_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                project_path TEXT NOT NULL,
                title TEXT NOT NULL,
                task_type TEXT NOT NULL,
                command TEXT,
                source_path TEXT,
                url TEXT,
                browser_action TEXT,
                connector_id TEXT,
                tool_name TEXT,
                connector_arguments_json TEXT,
                requires_approval INTEGER NOT NULL,
                preview_steps_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cowork_runs (
                run_id TEXT PRIMARY KEY,
                plan_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                task_type TEXT NOT NULL,
                status TEXT NOT NULL,
                summary TEXT NOT NULL,
                details_json TEXT NOT NULL,
                trigger_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS cowork_jobs (
                job_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                project_path TEXT NOT NULL,
                title TEXT NOT NULL,
                trigger_type TEXT NOT NULL,
                interval_seconds INTEGER NOT NULL,
                watch_path TEXT,
                watch_absolute TEXT,
                watch_mtime REAL,
                task_type TEXT NOT NULL,
                command TEXT,
                source_path TEXT,
                url TEXT,
                browser_action TEXT,
                enabled INTEGER NOT NULL,
                consecutive_failures INTEGER NOT NULL,
                circuit_broken INTEGER NOT NULL,
                circuit_broken_reason TEXT,
                next_run_at TEXT,
                last_run_at TEXT,
                last_status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cowork_extractions (
                extraction_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                source_path TEXT NOT NULL,
                method TEXT NOT NULL,
                byte_size INTEGER NOT NULL,
                text_excerpt TEXT NOT NULL,
                entities_json TEXT NOT NULL,
                warnings_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_knowledge (
                knowledge_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL UNIQUE,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                project_path TEXT NOT NULL,
                summary TEXT NOT NULL,
                items_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS team_workspaces (
                workspace_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS team_workspace_members (
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (workspace_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS session_shares (
                share_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                access_level TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS team_delegations (
                task_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                requester_id TEXT NOT NULL,
                assigned_role TEXT NOT NULL,
                task TEXT NOT NULL,
                priority TEXT NOT NULL,
                status TEXT NOT NULL,
                note TEXT NOT NULL,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                event_id TEXT PRIMARY KEY,
                actor_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                workspace_id TEXT,
                session_id TEXT,
                metadata_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS session_artifacts (
                artifact_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                kind TEXT NOT NULL,
                content TEXT NOT NULL,
                source_message_id TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_templates (
                template_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                prompt_prefix TEXT NOT NULL,
                verify_command TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS remote_channels (
                channel_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                label TEXT NOT NULL,
                pairing_code TEXT NOT NULL UNIQUE,
                paired_client_id TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS team_style_guides (
                guide_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                title TEXT NOT NULL,
                guide_type TEXT NOT NULL,
                content TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS organizations (
                org_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                plan_id TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS organization_members (
                org_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (org_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS workspace_session_grants (
                grant_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                granted_to_user_id TEXT NOT NULL,
                granted_by TEXT NOT NULL,
                access_level TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS taste_events (
                event_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                proposal_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                target_file TEXT NOT NULL,
                project_path TEXT,
                signal_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS taste_rules (
                rule_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                scope TEXT NOT NULL,
                project_path TEXT,
                rule_text TEXT NOT NULL,
                weight INTEGER NOT NULL,
                source_event_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_agent_preferences (
                user_id TEXT PRIMARY KEY,
                caveman_mode TEXT NOT NULL DEFAULT 'off',
                enabled_skills_json TEXT NOT NULL DEFAULT '[]',
                rtk_enabled INTEGER NOT NULL DEFAULT 0,
                rtk_last_stats_json TEXT NOT NULL DEFAULT '{}',
                agent_engine TEXT NOT NULL DEFAULT 'codeforge',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_memories (
                memory_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                scope TEXT NOT NULL,
                kind TEXT NOT NULL,
                content TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                source_session_id TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        for statement in INDEX_STATEMENTS:
            conn.execute(statement)
        _migrate_optional_columns(conn)
        conn.commit()
    finally:
        conn.close()


def _migrate_optional_columns(conn_or_cur=None) -> None:
    migrations = [
        "ALTER TABLE team_delegations ADD COLUMN orchestration_mode TEXT DEFAULT 'single'",
        "ALTER TABLE team_delegations ADD COLUMN agent_roles_json TEXT DEFAULT '[]'",
        "ALTER TABLE team_delegations ADD COLUMN steps_json TEXT DEFAULT '[]'",
        "ALTER TABLE team_delegations ADD COLUMN require_step_approval INTEGER DEFAULT 0",
        "ALTER TABLE team_delegations ADD COLUMN current_step_index INTEGER DEFAULT 0",
        "ALTER TABLE team_workspaces ADD COLUMN org_id TEXT",
        "ALTER TABLE billing_orders ADD COLUMN org_id TEXT",
        "ALTER TABLE user_subscriptions ADD COLUMN razorpay_subscription_id TEXT",
        "ALTER TABLE user_agent_preferences ADD COLUMN rtk_enabled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE user_agent_preferences ADD COLUMN rtk_last_stats_json TEXT NOT NULL DEFAULT '{}'",
        "ALTER TABLE user_agent_preferences ADD COLUMN agent_engine TEXT NOT NULL DEFAULT 'codeforge'",
        """
        CREATE TABLE IF NOT EXISTS agent_memories (
            memory_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            kind TEXT NOT NULL,
            content TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            source_session_id TEXT,
            created_at TEXT NOT NULL
        )
        """,
    ]
    for statement in migrations:
        try:
            if _is_postgres():
                with _pg_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(statement)
                    conn.commit()
            elif conn_or_cur is not None and hasattr(conn_or_cur, "execute"):
                conn_or_cur.execute(statement)
            else:
                _execute(statement)
        except Exception:
            pass


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


def get_session_by_id(session_id: str) -> dict[str, Any] | None:
    return _fetchone(
        "SELECT session_id, user_id, project_path, model_preference, created_at FROM sessions WHERE session_id = ?",
        (session_id,),
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


def latest_user_message_context(session_id: str) -> dict[str, Any]:
    import json

    row = _fetchone(
        "SELECT context_json FROM messages WHERE session_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1",
        (session_id,),
    )
    if not row or not row.get("context_json"):
        return {}
    try:
        payload = json.loads(row["context_json"])
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


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
    org_id: str | None = None,
) -> None:
    _execute(
        """
        INSERT INTO billing_orders(order_id, user_id, plan_id, amount_inr, currency, provider, status, created_at, org_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (order_id, user_id, plan_id, amount_inr, currency, provider, status, created_at, org_id),
    )


def get_billing_order(order_id: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT order_id, user_id, plan_id, amount_inr, currency, provider, status, created_at, org_id
        FROM billing_orders
        WHERE order_id = ?
        """,
        (order_id,),
    )
    if row is None:
        return None
    return {
        "order_id": row["order_id"],
        "user_id": row["user_id"],
        "plan_id": row["plan_id"],
        "amount_inr": int(row["amount_inr"]),
        "currency": row["currency"],
        "provider": row["provider"],
        "status": row["status"],
        "created_at": row["created_at"],
        "org_id": row["org_id"],
    }


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
    razorpay_subscription_id: str | None = None,
) -> None:
    if _is_postgres():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_subscriptions(
                        user_id, plan_id, status, amount_inr, order_id, updated_at, razorpay_subscription_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET
                        plan_id = EXCLUDED.plan_id,
                        status = EXCLUDED.status,
                        amount_inr = EXCLUDED.amount_inr,
                        order_id = EXCLUDED.order_id,
                        updated_at = EXCLUDED.updated_at,
                        razorpay_subscription_id = COALESCE(
                            EXCLUDED.razorpay_subscription_id,
                            user_subscriptions.razorpay_subscription_id
                        )
                    """,
                    (user_id, plan_id, status, amount_inr, order_id, updated_at, razorpay_subscription_id),
                )
            conn.commit()
        return

    conn = _sqlite_connection()
    try:
        conn.execute(
            """
            INSERT INTO user_subscriptions(
                user_id, plan_id, status, amount_inr, order_id, updated_at, razorpay_subscription_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                plan_id = excluded.plan_id,
                status = excluded.status,
                amount_inr = excluded.amount_inr,
                order_id = excluded.order_id,
                updated_at = excluded.updated_at,
                razorpay_subscription_id = COALESCE(
                    excluded.razorpay_subscription_id,
                    user_subscriptions.razorpay_subscription_id
                )
            """,
            (user_id, plan_id, status, amount_inr, order_id, updated_at, razorpay_subscription_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_user_subscription(user_id: str) -> dict[str, Any] | None:
    return _fetchone(
        """
        SELECT user_id, plan_id, status, amount_inr, order_id, updated_at, razorpay_subscription_id
        FROM user_subscriptions
        WHERE user_id = ?
        """,
        (user_id,),
    )


def get_user_subscription_by_razorpay_id(razorpay_subscription_id: str) -> dict[str, Any] | None:
    return _fetchone(
        """
        SELECT user_id, plan_id, status, amount_inr, order_id, updated_at, razorpay_subscription_id
        FROM user_subscriptions
        WHERE razorpay_subscription_id = ?
        """,
        (razorpay_subscription_id,),
    )


def get_latest_paid_order_for_user(user_id: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT order_id, user_id, plan_id, amount_inr, currency, provider, status, created_at, org_id
        FROM billing_orders
        WHERE user_id = ? AND status = 'paid'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (user_id,),
    )
    if row is None:
        return None
    return {
        "order_id": row["order_id"],
        "user_id": row["user_id"],
        "plan_id": row["plan_id"],
        "amount_inr": int(row["amount_inr"]),
        "currency": row["currency"],
        "provider": row["provider"],
        "status": row["status"],
        "created_at": row["created_at"],
        "org_id": row["org_id"],
    }


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


def insert_session_file_plan(
    *,
    plan_id: str,
    session_id: str,
    user_id: str,
    targets_json: str,
    snapshot_json: str,
    status: str,
    created_at: str,
) -> None:
    _execute(
        """
        INSERT INTO session_file_plans(
            plan_id, session_id, user_id, targets_json, snapshot_json, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (plan_id, session_id, user_id, targets_json, snapshot_json, status, created_at),
    )


def get_session_file_plan(plan_id: str, session_id: str, user_id: str) -> dict[str, Any] | None:
    return _fetchone(
        """
        SELECT plan_id, session_id, user_id, targets_json, snapshot_json, status, created_at, executed_at
        FROM session_file_plans
        WHERE plan_id = ? AND session_id = ? AND user_id = ?
        """,
        (plan_id, session_id, user_id),
    )


def update_session_file_plan_status(*, plan_id: str, status: str, executed_at: str | None = None) -> None:
    _execute(
        """
        UPDATE session_file_plans
        SET status = ?, executed_at = ?
        WHERE plan_id = ?
        """,
        (status, executed_at, plan_id),
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
            conn.commit()
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

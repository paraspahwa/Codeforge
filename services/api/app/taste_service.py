from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from . import taste_store
from .projects_team import projects_team_service

MAX_RULES_PER_USER = 50
_CAMEL_CASE = re.compile(r"\b[a-z]+[A-Z][a-zA-Z]*\b")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return utc_now().isoformat()


class TasteService:
    def record_proposal_decision(
        self,
        *,
        user_id: str,
        session_id: str,
        proposal: dict[str, Any],
        action: str,
        project_path: str | None = None,
        note: str | None = None,
        edited_content: str | None = None,
    ) -> list[str]:
        event_type = "reject" if action == "reject" else "approve"
        if action == "approve" and edited_content and edited_content != proposal["proposed_content"]:
            event_type = "approve_after_edit"

        signal = {
            "note": (note or "").strip() or None,
            "prompt_excerpt": (proposal.get("prompt") or "")[:160],
            "had_user_edit": bool(edited_content and edited_content != proposal["proposed_content"]),
        }
        event_id = f"taste_evt_{uuid4().hex[:12]}"
        taste_store.insert_taste_event(
            {
                "event_id": event_id,
                "user_id": user_id,
                "session_id": session_id,
                "proposal_id": proposal["proposal_id"],
                "event_type": event_type,
                "target_file": proposal["target_file"],
                "project_path": project_path,
                "signal": signal,
                "created_at": _utc_now_iso(),
            }
        )

        rules = self._distill_rules(
            proposal=proposal,
            event_type=event_type,
            note=note,
            edited_content=edited_content,
        )
        created_rule_ids: list[str] = []
        now = _utc_now_iso()
        for rule_text, weight in rules:
            existing = taste_store.get_taste_rule_by_text(user_id, rule_text)
            if existing:
                taste_store.update_taste_rule_weight(
                    existing["rule_id"],
                    weight=min(MAX_RULES_PER_USER, int(existing["weight"]) + weight),
                    updated_at=now,
                )
                created_rule_ids.append(existing["rule_id"])
                continue
            rule_id = f"taste_rule_{uuid4().hex[:12]}"
            taste_store.insert_taste_rule(
                {
                    "rule_id": rule_id,
                    "user_id": user_id,
                    "scope": "user",
                    "project_path": project_path,
                    "rule_text": rule_text,
                    "weight": weight,
                    "source_event_id": event_id,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            created_rule_ids.append(rule_id)

        self._prune_rules(user_id)
        return created_rule_ids

    def _distill_rules(
        self,
        *,
        proposal: dict[str, Any],
        event_type: str,
        note: str | None,
        edited_content: str | None,
    ) -> list[tuple[str, int]]:
        target = proposal["target_file"]
        proposed = proposal.get("proposed_content") or ""
        original = proposal.get("original_content") or ""
        rules: list[tuple[str, int]] = []

        if note and note.strip():
            rules.append((f"Follow user preference: {note.strip()[:220]}", 3))

        if event_type == "reject":
            rules.append(
                (f"Rejected edit to {target}; stay closer to the file's existing structure and conventions.", 2)
            )
            if "TODO" in proposed or "FIXME" in proposed:
                rules.append(("Do not introduce TODO or FIXME markers in generated code.", 2))
            if target.endswith(".py") and _CAMEL_CASE.search(proposed) and not _CAMEL_CASE.search(original):
                rules.append(("Use snake_case naming in Python modules unless the file already uses another style.", 2))
        elif event_type == "approve_after_edit":
            rules.append(
                (
                    f"User edited AI output for {target} before accepting; prefer smaller, targeted diffs.",
                    3,
                )
            )
        elif event_type == "approve":
            rules.append((f"Accepted change pattern for {target} (positive signal).", 1))

        return rules

    def _prune_rules(self, user_id: str) -> None:
        total = taste_store.count_taste_rules_for_user(user_id)
        if total <= MAX_RULES_PER_USER:
            return
        rules = taste_store.list_taste_rules_for_user(user_id, limit=total)
        overflow = total - MAX_RULES_PER_USER
        to_remove = sorted(rules, key=lambda row: (int(row["weight"]), row["updated_at"]))[:overflow]
        for row in to_remove:
            from .db import _execute

            _execute("DELETE FROM taste_rules WHERE rule_id = ?", (row["rule_id"],))

    def compose_taste_context(
        self,
        *,
        user_id: str,
        project_path: str | None = None,
        rule_limit: int = 8,
    ) -> str:
        sections: list[str] = []

        rules = taste_store.list_taste_rules_for_user(user_id, project_path=project_path, limit=rule_limit)
        if rules:
            sections.append("Personal coding taste (learned from your accept/reject decisions):")
            for rule in rules:
                sections.append(f"- {rule['rule_text']}")

        team_context = projects_team_service.compose_style_context(user_id=user_id)
        if team_context:
            sections.append(team_context)

        return "\n\n".join(sections)

    def render_taste_md(self, user_id: str) -> str:
        rules = taste_store.list_taste_rules_for_user(user_id, limit=MAX_RULES_PER_USER)
        lines = [
            "# CodeForge Taste",
            "",
            "Human-readable constraints learned from your proposal feedback.",
            "Edit this file manually; re-import via the taste API to sync.",
            "",
            "## Active rules",
            "",
        ]
        if not rules:
            lines.append("- No taste rules yet. Approve or reject proposals to build your profile.")
        else:
            for rule in rules:
                lines.append(f"- {rule['rule_text']}")
        lines.extend(["", f"_Updated: {_utc_now_iso()}_"])
        return "\n".join(lines)

    def get_stats(self, user_id: str) -> dict[str, Any]:
        counts = taste_store.count_taste_events_by_type(user_id)
        sessions = taste_store.count_distinct_sessions_with_events(user_id)
        rejections = counts.get("reject", 0)
        approvals = counts.get("approve", 0) + counts.get("approve_after_edit", 0)
        edits = counts.get("approve_after_edit", 0)
        total_events = sum(counts.values())
        avg_rejections = round(rejections / sessions, 2) if sessions else 0.0
        return {
            "user_id": user_id,
            "sessions_with_feedback": sessions,
            "total_events": total_events,
            "rejections": rejections,
            "approvals": approvals,
            "approvals_after_edit": edits,
            "active_rules": taste_store.count_taste_rules_for_user(user_id),
            "avg_rejections_per_session": avg_rejections,
        }

    def export_pack(self, user_id: str) -> dict[str, Any]:
        rules = taste_store.list_taste_rules_for_user(user_id, limit=MAX_RULES_PER_USER)
        return {
            "version": 1,
            "exported_at": _utc_now_iso(),
            "user_id": user_id,
            "rules": [
                {
                    "rule_text": row["rule_text"],
                    "weight": int(row["weight"]),
                    "scope": row.get("scope") or "user",
                    "project_path": row.get("project_path"),
                }
                for row in rules
            ],
        }

    def import_pack(self, user_id: str, pack: dict[str, Any]) -> int:
        rules = pack.get("rules") or []
        now = _utc_now_iso()
        inserted = 0
        for item in rules:
            rule_text = str(item.get("rule_text") or "").strip()
            if not rule_text:
                continue
            existing = taste_store.get_taste_rule_by_text(user_id, rule_text)
            if existing:
                taste_store.update_taste_rule_weight(
                    existing["rule_id"],
                    weight=int(item.get("weight") or existing["weight"]),
                    updated_at=now,
                )
                continue
            taste_store.insert_taste_rule(
                {
                    "rule_id": f"taste_rule_{uuid4().hex[:12]}",
                    "user_id": user_id,
                    "scope": str(item.get("scope") or "imported"),
                    "project_path": item.get("project_path"),
                    "rule_text": rule_text,
                    "weight": int(item.get("weight") or 2),
                    "source_event_id": None,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            inserted += 1
        self._prune_rules(user_id)
        return inserted


taste_service = TasteService()

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import skills_store
from .hermes_adapter import VALID_AGENT_ENGINES

VALID_CAVEMAN_MODES = {"off", "lite", "full", "ultra"}
CAVEMAN_ON_TRIGGERS = (
    "caveman mode",
    "talk like caveman",
    "use caveman",
    "/caveman",
    "less tokens",
    "few token",
    "save tokens",
    "be brief",
    "token saver",
)
CAVEMAN_OFF_TRIGGERS = ("stop caveman", "normal mode", "disable caveman")
LEVEL_PATTERN = re.compile(r"/caveman\s+(lite|full|ultra)\b", re.IGNORECASE)
FRONTMATTER_PATTERN = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _repo_skills_root() -> Path:
    configured = os.getenv("CODEFORGE_REPO_ROOT", "").strip()
    if configured:
        return Path(configured).resolve() / ".codeforge" / "skills"

    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / ".codeforge" / "skills"
        if candidate.exists():
            return candidate

    # Docker API layout: /app/app/skills_service.py -> /app/.codeforge/skills
    api_root = here.parents[1] if len(here.parents) > 1 else here.parent
    return api_root / ".codeforge" / "skills"


def _parse_frontmatter(raw: str) -> tuple[dict[str, str], str]:
    match = FRONTMATTER_PATTERN.match(raw)
    if not match:
        return {}, raw.strip()
    meta: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip("> ").strip()
    body = raw[match.end() :].strip()
    return meta, body


def _read_skill_file(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    raw = path.read_text(encoding="utf-8")
    meta, body = _parse_frontmatter(raw)
    return {
        "name": meta.get("name") or path.parent.name,
        "description": meta.get("description", ""),
        "source": meta.get("source"),
        "license": meta.get("license"),
        "slash": meta.get("slash", ""),
        "keywords": meta.get("keywords", ""),
        "body": body,
        "path": str(path),
        "origin": "project" if ".codeforge" in str(path) and "Indi-claude" not in str(path) else "bundled",
    }


class SkillsService:
    def bundled_skills_root(self) -> Path:
        root = _repo_skills_root()
        root.mkdir(parents=True, exist_ok=True)
        return root

    def project_skills_root(self, project_path: str | None) -> Path | None:
        if not project_path:
            return None
        root = Path(project_path).resolve() / ".codeforge" / "skills"
        return root if root.exists() else None

    def resolve_skill_path(self, skill_name: str, project_path: str | None = None) -> Path | None:
        project_root = self.project_skills_root(project_path)
        if project_root:
            project_skill = project_root / skill_name / "SKILL.md"
            if project_skill.is_file():
                return project_skill
        bundled_skill = self.bundled_skills_root() / skill_name / "SKILL.md"
        if bundled_skill.is_file():
            return bundled_skill
        return None

    def load_skill(self, skill_name: str, project_path: str | None = None) -> dict[str, Any] | None:
        path = self.resolve_skill_path(skill_name, project_path)
        if path is None:
            return None
        skill = _read_skill_file(path)
        if skill is None:
            return None
        project_root = self.project_skills_root(project_path)
        if project_root and path.is_relative_to(project_root):
            skill["origin"] = "project"
        else:
            skill["origin"] = "bundled"
        return skill

    def list_skills(self, project_path: str | None = None) -> list[dict[str, Any]]:
        discovered: dict[str, dict[str, Any]] = {}
        for root, origin in (
            (self.bundled_skills_root(), "bundled"),
            (self.project_skills_root(project_path), "project"),
        ):
            if not root or not root.exists():
                continue
            for skill_dir in sorted(root.iterdir()):
                if not skill_dir.is_dir():
                    continue
                skill = _read_skill_file(skill_dir / "SKILL.md")
                if not skill:
                    continue
                skill["origin"] = origin
                discovered[skill["name"]] = {
                    "name": skill["name"],
                    "description": skill["description"],
                    "origin": origin,
                    "path": skill["path"],
                    "source": skill.get("source"),
                    "license": skill.get("license"),
                    "slash": skill.get("slash", ""),
                    "keywords": skill.get("keywords", ""),
                }
        return list(discovered.values())

    def get_preferences(self, user_id: str) -> dict[str, Any]:
        return skills_store.get_user_agent_preferences(user_id)

    def update_preferences(
        self,
        *,
        user_id: str,
        caveman_mode: str | None = None,
        enabled_skills: list[str] | None = None,
        rtk_enabled: bool | None = None,
        agent_engine: str | None = None,
        permission_mode: str | None = None,
        plan_mode_default: bool | None = None,
        enabled_extensions: list[str] | None = None,
        extension_versions: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        current = self.get_preferences(user_id)
        mode = (caveman_mode or current["caveman_mode"]).strip().lower()
        if mode not in VALID_CAVEMAN_MODES:
            raise ValueError(f"Invalid caveman_mode: {mode}")
        engine = (agent_engine or current.get("agent_engine") or "codeforge").strip().lower()
        if engine not in VALID_AGENT_ENGINES:
            raise ValueError(f"Invalid agent_engine: {engine}")
        perm = (permission_mode or current.get("permission_mode") or "auto_safe").strip().lower()
        if perm not in {"ask", "auto_safe", "auto_all"}:
            raise ValueError(f"Invalid permission_mode: {perm}")
        skills = enabled_skills if enabled_skills is not None else list(current["enabled_skills"])
        cleaned_skills = sorted({item.strip() for item in skills if item and item.strip()})
        extensions = enabled_extensions if enabled_extensions is not None else list(current.get("enabled_extensions") or [])
        cleaned_extensions = sorted({item.strip() for item in extensions if item and item.strip()})
        extension_versions = extension_versions if extension_versions is not None else dict(current.get("extension_versions") or {})
        skills_store.upsert_user_agent_preferences(
            user_id=user_id,
            caveman_mode=mode,
            enabled_skills=cleaned_skills,
            updated_at=_utc_now_iso(),
            rtk_enabled=rtk_enabled if rtk_enabled is not None else current["rtk_enabled"],
            agent_engine=engine,
            permission_mode=perm,
            plan_mode_default=plan_mode_default if plan_mode_default is not None else current.get("plan_mode_default", False),
            enabled_extensions=cleaned_extensions,
            extension_versions=extension_versions,
        )
        return self.get_preferences(user_id)

    def resolve_agent_engine(self, user_id: str) -> str:
        from .hermes_adapter import resolve_agent_engine

        return resolve_agent_engine(self.get_preferences(user_id))

    def record_rtk_stats(self, user_id: str, stats: dict[str, Any]) -> None:
        current = self.get_preferences(user_id)
        skills_store.upsert_user_agent_preferences(
            user_id=user_id,
            caveman_mode=current["caveman_mode"],
            enabled_skills=list(current["enabled_skills"]),
            updated_at=_utc_now_iso(),
            rtk_enabled=current["rtk_enabled"],
            rtk_last_stats=stats,
        )

    def resolve_rtk_enabled(self, user_id: str | None) -> bool | None:
        if not user_id:
            return None
        from .rtk_service import env_rtk_enabled

        prefs = self.get_preferences(user_id)
        return bool(prefs.get("rtk_enabled")) or env_rtk_enabled()

    def _detect_ephemeral_caveman_mode(self, user_prompt: str, persisted_mode: str) -> str:
        prompt = (user_prompt or "").lower()
        if any(trigger in prompt for trigger in CAVEMAN_OFF_TRIGGERS):
            return "off"
        level_match = LEVEL_PATTERN.search(user_prompt or "")
        if level_match:
            return level_match.group(1).lower()
        if any(trigger in prompt for trigger in CAVEMAN_ON_TRIGGERS):
            return persisted_mode if persisted_mode != "off" else "full"
        return persisted_mode

    def _filter_caveman_body(self, body: str, mode: str) -> str:
        if mode == "off":
            return ""
        lines = [f"Active caveman intensity: **{mode}**.", ""]
        for line in body.splitlines():
            if line.startswith("| **") and mode not in line:
                continue
            if line.startswith("- lite:") or line.startswith("- full:") or line.startswith("- ultra:"):
                if not line.startswith(f"- {mode}:"):
                    continue
            lines.append(line)
        return "\n".join(lines).strip()

    def compose_agent_instructions(
        self,
        *,
        user_id: str,
        project_path: str | None,
        user_prompt: str,
    ) -> tuple[str, dict[str, Any]]:
        prefs = self.get_preferences(user_id)
        caveman_mode = self._detect_ephemeral_caveman_mode(user_prompt, prefs["caveman_mode"])
        sections: list[str] = []
        active_skills: list[str] = []

        if caveman_mode != "off":
            caveman = self.load_skill("caveman", project_path)
            if caveman:
                active_skills.append("caveman")
                sections.append(self._filter_caveman_body(caveman["body"], caveman_mode))

        for skill_name in prefs.get("enabled_skills", []):
            if skill_name == "caveman":
                continue
            skill = self.load_skill(skill_name, project_path)
            if not skill:
                continue
            active_skills.append(skill_name)
            sections.append(f"## Skill: {skill_name}\n{skill['body'][:2500]}")

        prompt_lower = (user_prompt or "").lower()
        for listed in self.list_skills(project_path):
            if listed["name"] in active_skills:
                continue
            keywords = str(listed.get("keywords", "")).strip()
            if not keywords:
                continue
            for keyword in keywords.split(","):
                token = keyword.strip().lower()
                if token and token in prompt_lower:
                    skill = self.load_skill(listed["name"], project_path)
                    if skill:
                        active_skills.append(listed["name"])
                        sections.append(f"## Skill: {listed['name']}\n{skill['body'][:2500]}")
                    break

        instructions = "\n\n".join(section for section in sections if section.strip())
        meta = {
            "caveman_mode": caveman_mode,
            "active_skills": active_skills,
            "token_saver_enabled": caveman_mode != "off",
        }
        return instructions, meta

    def resolve_skill_by_slash(self, slash_command: str, project_path: str | None = None) -> dict[str, Any] | None:
        normalized = slash_command.strip().lower()
        if not normalized.startswith("/"):
            normalized = f"/{normalized}"
        for listed in self.list_skills(project_path):
            slash = str(listed.get("slash", "")).strip().lower()
            if slash and slash == normalized:
                return self.load_skill(listed["name"], project_path)
        return None


skills_service = SkillsService()

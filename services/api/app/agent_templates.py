from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from . import agent_template_store


class AgentTemplateError(RuntimeError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AgentTemplateService:
    def create_template(
        self,
        *,
        user_id: str,
        name: str,
        description: str,
        prompt_prefix: str,
        verify_command: str | None = None,
    ) -> dict[str, Any]:
        template = {
            "template_id": f"tmpl_{uuid4().hex[:10]}",
            "user_id": user_id,
            "name": name.strip(),
            "description": description.strip(),
            "prompt_prefix": prompt_prefix.strip(),
            "verify_command": verify_command.strip() if verify_command else None,
            "created_at": utc_now().isoformat(),
        }
        if len(template["name"]) < 2:
            raise AgentTemplateError("Template name is required")
        if len(template["prompt_prefix"]) < 8:
            raise AgentTemplateError("Template prompt prefix is too short")
        agent_template_store.save_template(template)
        return template

    def list_templates(self, *, user_id: str) -> list[dict[str, Any]]:
        return agent_template_store.list_templates_for_user(user_id)

    def get_template(self, *, user_id: str, template_id: str) -> dict[str, Any]:
        template = agent_template_store.get_template(template_id, user_id)
        if template is None:
            raise AgentTemplateError("Template not found")
        return template

    def delete_template(self, *, user_id: str, template_id: str) -> None:
        if not agent_template_store.delete_template(template_id, user_id):
            raise AgentTemplateError("Template not found")

    def compose_prompt(self, *, user_id: str, template_id: str, user_task: str) -> dict[str, Any]:
        template = self.get_template(user_id=user_id, template_id=template_id)
        task = user_task.strip()
        if not task:
            raise AgentTemplateError("User task is required")
        composed = f"{template['prompt_prefix']}\n\nUser task:\n{task}"
        return {
            "template_id": template["template_id"],
            "name": template["name"],
            "composed_prompt": composed,
            "verify_command": template.get("verify_command"),
        }


agent_template_service = AgentTemplateService()

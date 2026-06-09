from __future__ import annotations

from typing import Any
from uuid import uuid4

from .db import get_user_subscription
from .models import utc_now
from .org_store import (
    downgrade_owned_organizations,
    get_organization,
    list_organizations_for_user,
    list_owned_organizations,
    save_organization,
    save_organization_member,
    set_workspace_org,
    update_organization_plan,
)


class OrgError(RuntimeError):
    pass


class OrgService:
    def create_organization(self, *, owner_id: str, name: str, plan_id: str = "team") -> dict[str, Any]:
        if plan_id not in {"lite", "pro", "team"}:
            raise OrgError("Organization plan must be lite, pro, or team")

        org_id = f"org_{uuid4().hex[:10]}"
        org = {
            "org_id": org_id,
            "name": name.strip(),
            "owner_id": owner_id,
            "plan_id": plan_id,
            "created_at": utc_now().isoformat(),
            "members": [
                {
                    "user_id": owner_id,
                    "role": "owner",
                    "added_at": utc_now().isoformat(),
                }
            ],
        }
        save_organization(org)
        for member in org["members"]:
            save_organization_member(org_id, member)
        return org

    def list_organizations(self, *, user_id: str) -> list[dict[str, Any]]:
        return list_organizations_for_user(user_id)

    def add_member(self, *, actor_id: str, org_id: str, member_user_id: str, role: str) -> dict[str, Any]:
        org = get_organization(org_id)
        if org is None:
            raise OrgError("Organization not found")

        actor_role = next((item["role"] for item in org["members"] if item["user_id"] == actor_id), None)
        if actor_id != org["owner_id"] and actor_role not in {"owner", "admin"}:
            raise OrgError("Only org owner/admin can add members")

        if role not in {"admin", "member", "viewer"}:
            raise OrgError("Invalid organization member role")

        member = {
            "user_id": member_user_id,
            "role": role,
            "added_at": utc_now().isoformat(),
        }
        save_organization_member(org_id, member)
        return get_organization(org_id) or org

    def link_workspace(self, *, actor_id: str, org_id: str, workspace_id: str) -> dict[str, Any]:
        from .projects_team_store import get_workspace

        org = get_organization(org_id)
        if org is None:
            raise OrgError("Organization not found")

        actor_role = next((item["role"] for item in org["members"] if item["user_id"] == actor_id), None)
        if actor_id != org["owner_id"] and actor_role not in {"owner", "admin"}:
            raise OrgError("Only org owner/admin can link workspaces")

        workspace = get_workspace(workspace_id)
        if workspace is None:
            raise OrgError("Workspace not found")

        if workspace["owner_id"] != actor_id and actor_id != org["owner_id"]:
            workspace_role = next((item["role"] for item in workspace["members"] if item["user_id"] == actor_id), None)
            if workspace_role not in {"owner", "admin"}:
                raise OrgError("Only workspace owner/admin or org owner/admin can link workspaces")

        set_workspace_org(workspace_id, org_id)
        updated = get_workspace(workspace_id) or workspace
        updated["org_id"] = org_id
        return updated

    def upgrade_organization_plan(
        self,
        *,
        actor_id: str,
        org_id: str,
        plan_id: str,
        require_active_subscription: bool = True,
    ) -> dict[str, Any]:
        if plan_id not in {"lite", "pro", "team"}:
            raise OrgError("Organization plan must be lite, pro, or team")

        org = get_organization(org_id)
        if org is None:
            raise OrgError("Organization not found")

        actor_role = next((item["role"] for item in org["members"] if item["user_id"] == actor_id), None)
        if actor_id != org["owner_id"] and actor_role not in {"owner", "admin"}:
            raise OrgError("Only org owner/admin can upgrade organization plan")

        priority = {"team": 3, "pro": 2, "lite": 1, "free": 0}
        if require_active_subscription:
            subscription = get_user_subscription(actor_id)
            if subscription is None or subscription.get("status") != "active":
                raise OrgError("Active personal subscription required to upgrade organization plan")
            subscription_plan = str(subscription.get("plan_id", "free"))
            if priority.get(plan_id, 0) > priority.get(subscription_plan, 0):
                raise OrgError("Subscription plan must be at least the requested organization plan tier")

        current_score = priority.get(str(org["plan_id"]), 0)
        next_score = priority.get(plan_id, 0)
        if next_score < current_score:
            raise OrgError("Organization plan can only be upgraded, not downgraded")

        update_organization_plan(org_id, plan_id)
        return get_organization(org_id) or org

    def sync_owned_orgs_after_subscription_lapse(self, *, owner_id: str, plan_id: str = "lite") -> list[str]:
        return downgrade_owned_organizations(owner_id, plan_id)

    def sync_owned_orgs_to_plan(self, *, owner_id: str, plan_id: str) -> list[str]:
        synced: list[str] = []
        for org in list_owned_organizations(owner_id):
            try:
                self.upgrade_organization_plan(
                    actor_id=owner_id,
                    org_id=org["org_id"],
                    plan_id=plan_id,
                    require_active_subscription=False,
                )
                synced.append(org["org_id"])
            except OrgError:
                continue
        return synced


org_service = OrgService()

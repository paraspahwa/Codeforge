"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton, Tabs } from "@codeforge/ui";
import { formatSessionListLabel } from "@codeforge/shared/sessions";

import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingPageHeader from "../../components/marketing/MarketingPageHeader";
import {
  addTeamWorkspaceMember,
  approveTeamDelegationStep,
  createTeamDelegation,
  createTeamWorkspace,
  executeTeamDelegation,
  getProjectKnowledge,
  listSessions,
  addOrganizationMember,
  createOrganization,
  createTeamStyleGuide,
  createWorkspaceSessionGrant,
  linkWorkspaceOrg,
  listOrganizations,
  listTeamAuditLog,
  listTeamDelegations,
  listTeamStyleGuides,
  listTeamWorkspaces,
  listWorkspaceSessionGrants,
  queryProjectKnowledge,
  rebuildProjectKnowledge,
  streamTeamEvents,
  uploadProjectKnowledge,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

export default function TeamPage() {
  const { token, ready } = useAuth();
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [delegations, setDelegations] = useState([]);
  const [knowledge, setKnowledge] = useState(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeResults, setKnowledgeResults] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("Core team");
  const [workspaceDescription, setWorkspaceDescription] = useState("Shared startup workspace");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("member");

  const [delegationRole, setDelegationRole] = useState("reviewer");
  const [delegationTask, setDelegationTask] = useState("Review recent changes and summarize risks");
  const [delegationPriority, setDelegationPriority] = useState("normal");
  const [delegationMode, setDelegationMode] = useState("sequential");
  const [delegationRoles, setDelegationRoles] = useState("reviewer, implementer");
  const [requireStepApproval, setRequireStepApproval] = useState(false);
  const [styleGuides, setStyleGuides] = useState([]);
  const [styleGuideTitle, setStyleGuideTitle] = useState("UI style guide");
  const [styleGuideType, setStyleGuideType] = useState("style");
  const [styleGuideContent, setStyleGuideContent] = useState(
    "Use concise headings, accessible contrast, and consistent component spacing.",
  );
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [orgName, setOrgName] = useState("Startup org");
  const [orgPlanId, setOrgPlanId] = useState("team");
  const [orgMemberUserId, setOrgMemberUserId] = useState("");
  const [orgMemberRole, setOrgMemberRole] = useState("member");
  const [sessionGrants, setSessionGrants] = useState([]);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAccessLevel, setGrantAccessLevel] = useState("delegate");

  const selectedWorkspace = useMemo(
    () => workspaces.find((entry) => entry.workspace_id === selectedWorkspaceId) || null,
    [selectedWorkspaceId, workspaces],
  );

  async function refreshTeamData(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const workspaceId = selectedWorkspaceId || null;
    const [nextWorkspaces, nextDelegations, nextSessions, nextAudit, nextGuides, nextOrgs, nextGrants] =
      await Promise.all([
      listTeamWorkspaces(activeToken),
      listTeamDelegations(activeToken, workspaceId),
      listSessions(activeToken),
      listTeamAuditLog(activeToken, workspaceId, 30),
      workspaceId
        ? listTeamStyleGuides(activeToken, workspaceId).catch(() => ({ guides: [] }))
        : Promise.resolve({ guides: [] }),
      listOrganizations(activeToken).catch(() => ({ organizations: [] })),
      workspaceId
        ? listWorkspaceSessionGrants(activeToken, workspaceId).catch(() => ({ grants: [] }))
        : Promise.resolve({ grants: [] }),
    ]);
    setWorkspaces(nextWorkspaces.workspaces || []);
    setDelegations(nextDelegations.delegations || []);
    setSessions(nextSessions);
    setAuditEvents(nextAudit.events || []);
    setStyleGuides(nextGuides.guides || []);
    setOrganizations(nextOrgs.organizations || []);
    setSessionGrants(nextGrants.grants || []);
    if (!selectedWorkspaceId && nextWorkspaces.workspaces?.length) {
      setSelectedWorkspaceId(nextWorkspaces.workspaces[0].workspace_id);
    }
    if (!sessionId && nextSessions.length) {
      setSessionId(nextSessions[0].session_id);
    }
    if (sessionId) {
      try {
        const kb = await getProjectKnowledge(activeToken, sessionId);
        setKnowledge(kb);
      } catch {
        setKnowledge(null);
      }
    }
  }

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    setLoading(true);
    refreshTeamData(token)
      .catch((error) => toast.push(error.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  useEffect(() => {
    if (!token || !selectedWorkspaceId) {
      return;
    }
    listTeamDelegations(token, selectedWorkspaceId)
      .then((result) => setDelegations(result.delegations || []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedWorkspaceId]);

  useEffect(() => {
    if (!token || !sessionId) {
      return;
    }
    getProjectKnowledge(token, sessionId)
      .then(setKnowledge)
      .catch(() => setKnowledge(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionId]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        for await (const event of streamTeamEvents(token)) {
          if (cancelled) {
            break;
          }
          if (event.type === "heartbeat" || event.type === "connected") {
            continue;
          }
          setLiveEvents((previous) => [JSON.stringify(event), ...previous].slice(0, 12));
          if (event.type === "team.audit") {
            await refreshTeamData(token);
          }
        }
      } catch {
        // Stream reconnects on next login.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreateWorkspace() {
    setLoading(true);
    try {
      const workspace = await createTeamWorkspace(token, {
        name: workspaceName,
        description: workspaceDescription,
      });
      toast.push(`Workspace ${workspace.workspace_id} created`, "success");
      await refreshTeamData(token);
      setSelectedWorkspaceId(workspace.workspace_id);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember() {
    if (!selectedWorkspaceId || !memberUserId.trim()) {
      toast.push("Select a workspace and enter a member user ID");
      return;
    }
    setLoading(true);
    try {
      await addTeamWorkspaceMember(token, selectedWorkspaceId, {
        user_id: memberUserId.trim(),
        role: memberRole,
      });
      toast.push("Member added", "success");
      await refreshTeamData(token);
      setMemberUserId("");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRebuildKnowledge() {
    if (!sessionId) {
      toast.push("Select a session first");
      return;
    }
    setLoading(true);
    try {
      const kb = await rebuildProjectKnowledge(token, {
        session_id: sessionId,
        title: "Team project knowledge",
      });
      setKnowledge(kb);
      toast.push(kb.summary, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadKnowledge(event) {
    const fileList = event.target.files;
    if (!sessionId || !fileList?.length) {
      toast.push("Select a session and at least one file");
      return;
    }
    setLoading(true);
    try {
      const kb = await uploadProjectKnowledge(token, sessionId, Array.from(fileList));
      setKnowledge(kb);
      toast.push(`Uploaded ${kb.uploaded_paths?.length || 0} file(s)`, "success");
      await refreshTeamData(token);
      event.target.value = "";
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleQueryKnowledge() {
    if (!sessionId || !knowledgeQuery.trim()) {
      toast.push("Select a session and enter a query");
      return;
    }
    setLoading(true);
    try {
      const result = await queryProjectKnowledge(token, {
        session_id: sessionId,
        query: knowledgeQuery.trim(),
        limit: 6,
      });
      setKnowledgeResults(result);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDelegation() {
    if (!selectedWorkspaceId || !sessionId || !delegationTask.trim()) {
      toast.push("Workspace, session, and task are required");
      return;
    }
    setLoading(true);
    try {
      const delegation = await createTeamDelegation(token, {
        workspace_id: selectedWorkspaceId,
        session_id: sessionId,
        assigned_role: delegationRole,
        task: delegationTask.trim(),
        priority: delegationPriority,
        orchestration_mode: delegationMode,
        agent_roles: delegationRoles
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean),
        require_step_approval: requireStepApproval,
      });
      toast.push(`Delegation ${delegation.task_id} queued`, "success");
      await refreshTeamData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrganization() {
    setLoading(true);
    try {
      const org = await createOrganization(token, {
        name: orgName.trim(),
        plan_id: orgPlanId,
      });
      toast.push(`Organization ${org.org_id} created`, "success");
      setSelectedOrgId(org.org_id);
      await refreshTeamData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddOrgMember() {
    if (!selectedOrgId || !orgMemberUserId.trim()) {
      toast.push("Select an organization and enter a member user ID");
      return;
    }
    setLoading(true);
    try {
      await addOrganizationMember(token, selectedOrgId, {
        user_id: orgMemberUserId.trim(),
        role: orgMemberRole,
      });
      toast.push("Organization member added", "success");
      setOrgMemberUserId("");
      await refreshTeamData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkWorkspaceOrg() {
    if (!selectedWorkspaceId || !selectedOrgId) {
      toast.push("Select a workspace and organization to link");
      return;
    }
    setLoading(true);
    try {
      await linkWorkspaceOrg(token, selectedWorkspaceId, selectedOrgId);
      toast.push("Workspace linked to organization", "success");
      await refreshTeamData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSessionGrant() {
    if (!selectedWorkspaceId || !sessionId || !grantUserId.trim()) {
      toast.push("Workspace, session, and granted user ID are required");
      return;
    }
    setLoading(true);
    try {
      const grant = await createWorkspaceSessionGrant(token, selectedWorkspaceId, {
        session_id: sessionId,
        granted_to_user_id: grantUserId.trim(),
        access_level: grantAccessLevel,
      });
      toast.push(`Session grant ${grant.grant_id} created`, "success");
      setGrantUserId("");
      await refreshTeamData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStyleGuide() {
    if (!selectedWorkspaceId || !styleGuideTitle.trim() || !styleGuideContent.trim()) {
      toast.push("Workspace, title, and content are required");
      return;
    }
    setLoading(true);
    try {
      await createTeamStyleGuide(token, selectedWorkspaceId, {
        title: styleGuideTitle.trim(),
        guide_type: styleGuideType,
        content: styleGuideContent.trim(),
      });
      await refreshTeamData(token);
      toast.push("Style guide saved", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteDelegation(taskId) {
    setLoading(true);
    try {
      const result = await executeTeamDelegation(token, taskId);
      toast.push(`Delegation ${taskId}: ${result.status}`, result.status === "completed" ? "success" : undefined);
      await refreshTeamData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelegationStepDecision(taskId, approved) {
    setLoading(true);
    try {
      const result = await approveTeamDelegationStep(token, taskId, { approved });
      toast.push(
        `Delegation ${taskId}: ${result.status}`,
        approved && result.status === "completed" ? "success" : undefined,
      );
      await refreshTeamData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (ready && !token) {
    return null;
  }

  if (!ready) {
    return (
      <section className="panel">
        <Skeleton style={{ height: "2rem", marginBottom: "1rem" }} />
        <Skeleton style={{ height: "12rem" }} />
      </section>
    );
  }

  const workspacesTab = (
    <div className="grid">
        <section className="panel">
          <h3>Organizations</h3>
          <p className="small">Billing-tier org entities for plan-aware usage policy.</p>
          <label className="small" htmlFor="orgName">
            Name
          </label>
          <input id="orgName" value={orgName} onChange={(event) => setOrgName(event.target.value)} />
          <label className="small" htmlFor="orgPlanId">
            Plan
          </label>
          <select id="orgPlanId" value={orgPlanId} onChange={(event) => setOrgPlanId(event.target.value)}>
            <option value="lite">Lite</option>
            <option value="pro">Pro</option>
            <option value="team">Team</option>
          </select>
          <button type="button" onClick={handleCreateOrganization} disabled={loading}>
            Create organization
          </button>
          <hr className="divider" />
          {organizations.length === 0 ? <p className="small">No organizations yet.</p> : null}
          {organizations.map((org) => (
            <button
              key={org.org_id}
              type="button"
              className={`ghost-btn ${org.org_id === selectedOrgId ? "ghost-btn-active" : ""}`}
              onClick={() => setSelectedOrgId(org.org_id)}
            >
              {org.name}
              <span className="small block">
                {org.org_id} · {org.plan_id}
              </span>
            </button>
          ))}
          {selectedOrgId ? (
            <>
              <hr className="divider" />
              <label className="small" htmlFor="orgMemberUserId">
                Add org member user ID
              </label>
              <input
                id="orgMemberUserId"
                value={orgMemberUserId}
                onChange={(event) => setOrgMemberUserId(event.target.value)}
              />
              <select value={orgMemberRole} onChange={(event) => setOrgMemberRole(event.target.value)}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="button" onClick={handleAddOrgMember} disabled={loading}>
                Add org member
              </button>
              {selectedWorkspaceId ? (
                <button type="button" className="ghost-btn" onClick={handleLinkWorkspaceOrg} disabled={loading}>
                  Link selected workspace to org
                </button>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="panel">
          <h3>Workspaces</h3>
          <label className="small" htmlFor="workspaceName">
            Name
          </label>
          <input id="workspaceName" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
          <label className="small" htmlFor="workspaceDescription">
            Description
          </label>
          <input
            id="workspaceDescription"
            value={workspaceDescription}
            onChange={(event) => setWorkspaceDescription(event.target.value)}
          />
          <button type="button" onClick={handleCreateWorkspace} disabled={loading}>
            Create workspace
          </button>

          <hr className="divider" />
          {workspaces.length === 0 ? <p className="small">No workspaces yet.</p> : null}
          {workspaces.map((workspace) => (
            <button
              key={workspace.workspace_id}
              type="button"
              className={`ghost-btn ${workspace.workspace_id === selectedWorkspaceId ? "ghost-btn-active" : ""}`}
              onClick={() => setSelectedWorkspaceId(workspace.workspace_id)}
            >
              {workspace.name}
              <span className="small block">{workspace.workspace_id}</span>
            </button>
          ))}

          {selectedWorkspace ? (
            <>
              <hr className="divider" />
              {selectedWorkspace.org_id ? (
                <p className="small">
                  Linked org: <strong>{selectedWorkspace.org_id}</strong>
                </p>
              ) : (
                <p className="small">No organization linked yet.</p>
              )}
              <h4>Members</h4>
              {(selectedWorkspace.members || []).map((member) => (
                <p key={member.user_id} className="small">
                  {member.user_id} — {member.role}
                </p>
              ))}
              <label className="small" htmlFor="memberUserId">
                Add member user ID
              </label>
              <input
                id="memberUserId"
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
              />
              <label className="small" htmlFor="memberRole">
                Role
              </label>
              <select id="memberRole" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="button" onClick={handleAddMember} disabled={loading}>
                Add member
              </button>
            </>
          ) : null}
        </section>
    </div>
  );

  const auditTab = (
      <section className="panel">
        <h3>Audit log</h3>
        {auditEvents.length === 0 ? (
          <p className="small">No team or knowledge events yet.</p>
        ) : (
          <ul className="small">
            {auditEvents.map((event) => (
              <li key={event.event_id}>
                <strong>{event.event_type}</strong> · {event.resource_type}/{event.resource_id}
                {event.workspace_id ? ` · ${event.workspace_id}` : ""}
              </li>
            ))}
          </ul>
        )}
        <h4 className="small mt-8">Live team events</h4>
        {liveEvents.length === 0 ? (
          <p className="small">Connected SSE stream waiting for workspace updates…</p>
        ) : (
          <ul className="small">
            {liveEvents.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        )}
      </section>
  );

  const grantsTab = (
      <section className="panel">
        <h3>Session grants</h3>
        <p className="small">Grant workspace members delegated access to your session for team workflows.</p>
        {sessionGrants.length === 0 ? <p className="small">No session grants for this workspace.</p> : null}
        <ul className="small">
          {sessionGrants.map((grant) => (
            <li key={grant.grant_id}>
              <strong>{grant.granted_to_user_id}</strong> · {grant.session_id} · {grant.access_level}
            </li>
          ))}
        </ul>
        <label className="small" htmlFor="grantUserId">
          Grant to user ID
        </label>
        <input id="grantUserId" value={grantUserId} onChange={(event) => setGrantUserId(event.target.value)} />
        <label className="small" htmlFor="grantAccessLevel">
          Access level
        </label>
        <select
          id="grantAccessLevel"
          value={grantAccessLevel}
          onChange={(event) => setGrantAccessLevel(event.target.value)}
        >
          <option value="view">View</option>
          <option value="delegate">Delegate</option>
        </select>
        <button type="button" onClick={handleCreateSessionGrant} disabled={loading || !selectedWorkspaceId || !sessionId}>
          Grant session access
        </button>
      </section>
  );

  const styleTab = (
      <section className="panel">
        <h3>Shared style guides</h3>
        {styleGuides.length === 0 ? <p className="small">No style guides for this workspace yet.</p> : null}
        <ul className="small">
          {styleGuides.map((guide) => (
            <li key={guide.guide_id}>
              <strong>{guide.title}</strong> ({guide.guide_type}) — {guide.content.slice(0, 160)}
            </li>
          ))}
        </ul>
        <label className="small" htmlFor="styleGuideTitle">
          Title
        </label>
        <input id="styleGuideTitle" value={styleGuideTitle} onChange={(event) => setStyleGuideTitle(event.target.value)} />
        <label className="small" htmlFor="styleGuideType">
          Type
        </label>
        <select id="styleGuideType" value={styleGuideType} onChange={(event) => setStyleGuideType(event.target.value)}>
          <option value="style">Style</option>
          <option value="conventions">Conventions</option>
          <option value="architecture">Architecture</option>
        </select>
        <label className="small" htmlFor="styleGuideContent">
          Content
        </label>
        <textarea
          id="styleGuideContent"
          rows={4}
          value={styleGuideContent}
          onChange={(event) => setStyleGuideContent(event.target.value)}
        />
        <button type="button" onClick={handleCreateStyleGuide} disabled={loading || !selectedWorkspaceId}>
          Save style guide
        </button>
      </section>
  );

  const delegationsTab = (
      <section className="panel">
        <h3>Delegations</h3>
        <div className="grid">
          <div>
            <label className="small" htmlFor="delegationRole">
              Assigned role
            </label>
            <input
              id="delegationRole"
              value={delegationRole}
              onChange={(event) => setDelegationRole(event.target.value)}
            />
            <label className="small" htmlFor="delegationTask">
              Task
            </label>
            <textarea
              id="delegationTask"
              rows={3}
              value={delegationTask}
              onChange={(event) => setDelegationTask(event.target.value)}
            />
            <label className="small" htmlFor="delegationPriority">
              Priority
            </label>
            <select
              id="delegationPriority"
              value={delegationPriority}
              onChange={(event) => setDelegationPriority(event.target.value)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <label className="small" htmlFor="delegationMode">
              Orchestration mode
            </label>
            <select id="delegationMode" value={delegationMode} onChange={(event) => setDelegationMode(event.target.value)}>
              <option value="single">Single agent</option>
              <option value="sequential">Sequential multi-agent</option>
              <option value="supervisor">Supervisor + worker</option>
            </select>
            <label className="small" htmlFor="delegationRoles">
              Agent roles (comma-separated)
            </label>
            <input
              id="delegationRoles"
              value={delegationRoles}
              onChange={(event) => setDelegationRoles(event.target.value)}
            />
            <label className="small" htmlFor="requireStepApproval">
              <input
                id="requireStepApproval"
                type="checkbox"
                checked={requireStepApproval}
                onChange={(event) => setRequireStepApproval(event.target.checked)}
              />{" "}
              Require approval between orchestration steps
            </label>
            <button type="button" onClick={handleCreateDelegation} disabled={loading || !selectedWorkspaceId}>
              Queue delegation
            </button>
          </div>
          <div>
            {delegations.length === 0 ? <p className="small">No delegations yet.</p> : null}
            {delegations.map((item) => (
              <div key={item.task_id} className="stack" style={{ marginBottom: "0.75rem" }}>
                <strong>
                  {item.assigned_role}: {item.task}
                </strong>
                <span className="small">
                  {item.task_id} · {item.status} · {item.priority}
                </span>
                <p className="small">{item.note}</p>
                {item.steps?.length ? (
                  <ul className="small">
                    {item.steps.map((step) => (
                      <li key={`${item.task_id}-${step.step_index}`}>
                        {step.role}: {step.status}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.status === "queued" || item.status === "failed" ? (
                  <button type="button" className="ghost-btn inline-btn" onClick={() => handleExecuteDelegation(item.task_id)} disabled={loading}>
                    Execute
                  </button>
                ) : null}
                {item.status === "awaiting_approval" ? (
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="ghost-btn inline-btn"
                      onClick={() => handleDelegationStepDecision(item.task_id, true)}
                      disabled={loading}
                    >
                      Approve step
                    </button>
                    <button
                      type="button"
                      className="ghost-btn inline-btn"
                      onClick={() => handleDelegationStepDecision(item.task_id, false)}
                      disabled={loading}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
  );

  const knowledgeTab = (
    <section className="panel">
      <h3>Project knowledge</h3>
      <label className="small" htmlFor="teamSession">
        Session
      </label>
      <select id="teamSession" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
        {sessions.map((session) => (
          <option key={session.session_id} value={session.session_id}>
            {formatSessionListLabel(session)}
          </option>
        ))}
      </select>
      <div className="stack">
        <button type="button" onClick={handleRebuildKnowledge} disabled={loading || !sessionId}>
          Rebuild knowledge index
        </button>
        <label className="small" htmlFor="knowledgeUpload">
          Upload knowledge files
        </label>
        <input
          id="knowledgeUpload"
          type="file"
          multiple
          accept=".md,.txt,.json,.yaml,.yml,.py,.js,.jsx,.ts,.tsx,.html,.css,.toml,.sh,.go,.rs,.java"
          onChange={handleUploadKnowledge}
          disabled={loading || !sessionId}
        />
      </div>
      {knowledge ? (
        <p className="small">
          {knowledge.summary} · {knowledge.items?.length || 0} files indexed
        </p>
      ) : (
        <EmptyState title="No knowledge index" description="Rebuild or upload files for this session." />
      )}
      <label className="small" htmlFor="knowledgeQuery">
        Query knowledge
      </label>
      <input
        id="knowledgeQuery"
        value={knowledgeQuery}
        onChange={(event) => setKnowledgeQuery(event.target.value)}
        placeholder="auth middleware, billing flow..."
      />
      <button type="button" onClick={handleQueryKnowledge} disabled={loading}>
        Search
      </button>
      {knowledgeResults?.results?.length ? (
        <ul className="small">
          {knowledgeResults.results.map((item) => (
            <li key={item.path}>
              <strong>{item.path}</strong> — {item.excerpt}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );

  return (
    <>
      <MarketingPageHeader
        eyebrow="Account"
        title="Team"
        lead="Shared workspaces, project knowledge indexing, and delegated agent tasks for collaborative workflows."
      />
      <LandingContainer>
        <div className="stack mkt-account-content mkt-settings-content">
      <Tabs
        defaultTab="workspaces"
        tabs={[
          { id: "workspaces", label: "Workspaces", content: workspacesTab },
          { id: "delegations", label: "Delegations", content: delegationsTab },
          { id: "knowledge", label: "Knowledge", content: knowledgeTab },
          { id: "grants", label: "Grants", content: grantsTab },
          { id: "style", label: "Style guides", content: styleTab },
          { id: "audit", label: "Audit", content: auditTab },
        ]}
      />
        </div>
      </LandingContainer>
    </>
  );
}

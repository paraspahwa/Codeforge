import { useEffect, useMemo, useRef, useState } from "react";
import { formatSessionListLabel } from "@codeforge/shared/sessions";
import { useDesktopAuth } from "./DesktopAuthContext";
import {
  addTeamWorkspaceMember,
  createSessionShare,
  approveTeamDelegationStep,
  createTeamDelegation,
  createTeamStyleGuide,
  createTeamWorkspace,
  createWorkspaceSessionGrant,
  executeTeamDelegation,
  exportSession,
  getProjectKnowledge,
  listSessions,
  listTeamAuditLog,
  listTeamDelegations,
  listTeamStyleGuides,
  listTeamWorkspaces,
  listWorkspaceSessionGrants,
  updateTeamStyleGuide,
  queryProjectKnowledge,
  rebuildProjectKnowledge,
  streamTeamEvents,
  uploadProjectKnowledge,
} from "./api";

export default function TeamWorkspace() {
  const { token } = useDesktopAuth();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [delegations, setDelegations] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [knowledge, setKnowledge] = useState(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeResults, setKnowledgeResults] = useState(null);
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
  const [shareOutput, setShareOutput] = useState("");
  const [liveEvents, setLiveEvents] = useState([]);
  const [styleGuides, setStyleGuides] = useState([]);
  const [styleGuideTitle, setStyleGuideTitle] = useState("API conventions");
  const [styleGuideType, setStyleGuideType] = useState("style");
  const [styleGuideContent, setStyleGuideContent] = useState(
    "Use snake_case for Python modules and keep route handlers thin.",
  );
  const [editingGuideId, setEditingGuideId] = useState("");
  const [sessionGrants, setSessionGrants] = useState([]);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAccessLevel, setGrantAccessLevel] = useState("delegate");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const streamRef = useRef(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((entry) => entry.workspace_id === selectedWorkspaceId) || null,
    [selectedWorkspaceId, workspaces],
  );

  async function refreshTeamData(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const workspaceId = selectedWorkspaceId || null;
    const [nextWorkspaces, nextDelegations, nextSessions, nextAudit, nextGuides, nextGrants] = await Promise.all([
      listTeamWorkspaces(activeToken),
      listTeamDelegations(activeToken, workspaceId),
      listSessions(activeToken),
      listTeamAuditLog(activeToken, workspaceId, 30),
      workspaceId
        ? listTeamStyleGuides(activeToken, workspaceId).catch(() => ({ guides: [] }))
        : Promise.resolve({ guides: [] }),
      workspaceId
        ? listWorkspaceSessionGrants(activeToken, workspaceId).catch(() => ({ grants: [] }))
        : Promise.resolve({ grants: [] }),
    ]);
    setWorkspaces(nextWorkspaces.workspaces || []);
    setDelegations(nextDelegations.delegations || []);
    setStyleGuides(nextGuides.guides || []);
    setSessionGrants(nextGrants.grants || []);
    setSessions(nextSessions);
    setAuditEvents(nextAudit.events || []);
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

  async function handleCreateWorkspace() {
    setLoading(true);
    setErrorMessage("");
    try {
      const workspace = await createTeamWorkspace(token, {
        name: workspaceName,
        description: workspaceDescription,
      });
      setSelectedWorkspaceId(workspace.workspace_id);
      await refreshTeamData(token);
      setStatusMessage(`Workspace ${workspace.workspace_id} created`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSessionGrant() {
    if (!selectedWorkspaceId || !sessionId || !grantUserId.trim()) {
      setErrorMessage("Workspace, session, and granted user ID are required");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const grant = await createWorkspaceSessionGrant(token, selectedWorkspaceId, {
        session_id: sessionId,
        granted_to_user_id: grantUserId.trim(),
        access_level: grantAccessLevel,
      });
      setGrantUserId("");
      await refreshTeamData(token);
      setStatusMessage(`Session grant ${grant.grant_id} created`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember() {
    if (!selectedWorkspaceId || !memberUserId.trim()) {
      setErrorMessage("Select a workspace and enter a member user ID");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      await addTeamWorkspaceMember(token, selectedWorkspaceId, {
        user_id: memberUserId.trim(),
        role: memberRole,
      });
      setMemberUserId("");
      await refreshTeamData(token);
      setStatusMessage("Member added");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRebuildKnowledge() {
    if (!sessionId) {
      setErrorMessage("Select a session first");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const kb = await rebuildProjectKnowledge(token, {
        session_id: sessionId,
        title: "Team project knowledge",
      });
      setKnowledge(kb);
      setStatusMessage(kb.summary);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadKnowledge(event) {
    const fileList = event.target.files;
    if (!sessionId || !fileList?.length) {
      setErrorMessage("Select a session and at least one file");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const kb = await uploadProjectKnowledge(token, sessionId, Array.from(fileList));
      setKnowledge(kb);
      await refreshTeamData(token);
      setStatusMessage(`Uploaded ${kb.uploaded_paths?.length || 0} file(s)`);
      event.target.value = "";
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleQueryKnowledge() {
    if (!sessionId || !knowledgeQuery.trim()) {
      setErrorMessage("Select a session and enter a query");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await queryProjectKnowledge(token, {
        session_id: sessionId,
        query: knowledgeQuery.trim(),
        limit: 6,
      });
      setKnowledgeResults(result);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveStyleGuide() {
    if (!selectedWorkspaceId || styleGuideTitle.trim().length < 2 || styleGuideContent.trim().length < 8) {
      setErrorMessage("Select a workspace and provide a title plus at least 8 characters of content");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      if (editingGuideId) {
        await updateTeamStyleGuide(token, selectedWorkspaceId, editingGuideId, {
          title: styleGuideTitle.trim(),
          guide_type: styleGuideType,
          content: styleGuideContent.trim(),
        });
        setStatusMessage(`Updated style guide ${editingGuideId}`);
      } else {
        const guide = await createTeamStyleGuide(token, selectedWorkspaceId, {
          title: styleGuideTitle.trim(),
          guide_type: styleGuideType,
          content: styleGuideContent.trim(),
        });
        setEditingGuideId(guide.guide_id);
        setStatusMessage(`Created style guide ${guide.guide_id}`);
      }
      await refreshTeamData(token);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEditStyleGuide(guide) {
    setEditingGuideId(guide.guide_id);
    setStyleGuideTitle(guide.title);
    setStyleGuideType(guide.guide_type);
    setStyleGuideContent(guide.content);
  }

  async function handleCreateDelegation() {
    if (!selectedWorkspaceId || !sessionId || !delegationTask.trim()) {
      setErrorMessage("Workspace, session, and task are required");
      return;
    }
    setLoading(true);
    setErrorMessage("");
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
      await refreshTeamData(token);
      setStatusMessage(`Delegation ${delegation.task_id} queued`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteDelegation(taskId) {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await executeTeamDelegation(token, taskId);
      await refreshTeamData(token);
      setStatusMessage(`Delegation ${taskId}: ${result.status}`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelegationStepDecision(taskId, approved) {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await approveTeamDelegationStep(token, taskId, { approved });
      await refreshTeamData(token);
      setStatusMessage(`Delegation ${taskId}: ${result.status}`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleShareSession() {
    if (!sessionId) {
      setErrorMessage("Select a session first");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const share = await createSessionShare(token, sessionId);
      setShareOutput(share.share_url || share.share_id);
      setStatusMessage("Share link created");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportSession(format) {
    if (!sessionId) {
      setErrorMessage("Select a session first");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const exported = await exportSession(token, sessionId, format);
      setShareOutput(`${exported.format} export (${exported.content.length} chars)`);
      setStatusMessage(`Session exported as ${format}`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setWorkspaces([]);
      setDelegations([]);
      setSessions([]);
      return;
    }
    refreshTeamData(token).catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedWorkspaceId) {
      return;
    }
    listTeamDelegations(token, selectedWorkspaceId)
      .then((result) => setDelegations(result.delegations || []))
      .catch(() => undefined);
  }, [token, selectedWorkspaceId]);

  useEffect(() => {
    if (!token || !sessionId) {
      return;
    }
    getProjectKnowledge(token, sessionId)
      .then(setKnowledge)
      .catch(() => setKnowledge(null));
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
        // Stream reconnects on next login/token change.
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.cancel?.();
    };
  }, [token]);

  return (
    <div className="workspace-shell">
      <header className="workspace-header card">
        <h2>Team</h2>
        <p className="muted small">Workspaces, knowledge, delegations, and live team events.</p>
        {statusMessage ? <p className="small">{statusMessage}</p> : null}
        {errorMessage ? <p className="error small">{errorMessage}</p> : null}
      </header>

      <div className="workspace-grid">
        <section className="card tool-panel">
          <h3>Workspaces</h3>
          <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="name" disabled={loading} />
          <input
            value={workspaceDescription}
            onChange={(event) => setWorkspaceDescription(event.target.value)}
            placeholder="description"
            disabled={loading}
          />
          <button type="button" onClick={handleCreateWorkspace} disabled={!token || loading}>
            Create workspace
          </button>
          {workspaces.map((workspace) => (
            <button
              key={workspace.workspace_id}
              type="button"
              className={workspace.workspace_id === selectedWorkspaceId ? "file-item file-item-active" : "file-item"}
              onClick={() => setSelectedWorkspaceId(workspace.workspace_id)}
            >
              {workspace.name} ({workspace.workspace_id})
            </button>
          ))}
          {selectedWorkspace ? (
            <>
              <h4 className="small">Members</h4>
              {(selectedWorkspace.members || []).map((member) => (
                <p key={member.user_id} className="small">
                  {member.user_id} — {member.role}
                </p>
              ))}
              <input value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} placeholder="member user id" disabled={loading} />
              <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} disabled={loading}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="button" onClick={handleAddMember} disabled={!token || loading}>
                Add member
              </button>
            </>
          ) : null}
        </section>

        <section className="card tool-panel">
          <h3>Knowledge</h3>
          <select value={sessionId} onChange={(event) => setSessionId(event.target.value)} disabled={loading}>
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {formatSessionListLabel(session)}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleRebuildKnowledge} disabled={!token || !sessionId || loading}>
            Rebuild index
          </button>
          <input type="file" multiple onChange={handleUploadKnowledge} disabled={!token || !sessionId || loading} />
          {knowledge ? (
            <p className="small">
              {knowledge.summary} · {knowledge.items?.length || 0} files
            </p>
          ) : (
            <p className="muted small">No knowledge index yet.</p>
          )}
          <input value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} placeholder="query knowledge" disabled={loading} />
          <button type="button" onClick={handleQueryKnowledge} disabled={!token || loading}>
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
          <div className="button-row">
            <button type="button" onClick={handleShareSession} disabled={!token || !sessionId || loading}>
              Share session
            </button>
            <button type="button" onClick={() => handleExportSession("json")} disabled={!token || !sessionId || loading}>
              Export JSON
            </button>
            <button type="button" onClick={() => handleExportSession("markdown")} disabled={!token || !sessionId || loading}>
              Export MD
            </button>
          </div>
          {shareOutput ? <pre className="shell-output">{shareOutput}</pre> : null}
        </section>
      </div>

      <section className="card workspace-tools-wide">
        <div className="tool-panel">
          <h3>Delegations</h3>
          <input value={delegationRole} onChange={(event) => setDelegationRole(event.target.value)} placeholder="role" disabled={loading} />
          <textarea rows={3} value={delegationTask} onChange={(event) => setDelegationTask(event.target.value)} disabled={loading} />
          <select value={delegationPriority} onChange={(event) => setDelegationPriority(event.target.value)} disabled={loading}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
          <select value={delegationMode} onChange={(event) => setDelegationMode(event.target.value)} disabled={loading}>
            <option value="single">Single agent</option>
            <option value="sequential">Sequential multi-agent</option>
            <option value="supervisor">Supervisor + worker</option>
          </select>
          <input
            value={delegationRoles}
            onChange={(event) => setDelegationRoles(event.target.value)}
            placeholder="agent roles (comma-separated)"
            disabled={loading}
          />
          <label className="small">
            <input
              type="checkbox"
              checked={requireStepApproval}
              onChange={(event) => setRequireStepApproval(event.target.checked)}
              disabled={loading}
            />{" "}
            Require approval between steps
          </label>
          <button type="button" onClick={handleCreateDelegation} disabled={!token || loading}>
            Queue delegation
          </button>
          {delegations.map((item) => (
            <div key={item.task_id} className="small">
              <strong>
                {item.assigned_role}: {item.task}
              </strong>
              <p>
                {item.task_id} · {item.status}
              </p>
              {item.status === "queued" || item.status === "failed" ? (
                <button type="button" onClick={() => handleExecuteDelegation(item.task_id)} disabled={loading}>
                  Execute
                </button>
              ) : null}
              {item.status === "awaiting_approval" ? (
                <>
                  <button type="button" onClick={() => handleDelegationStepDecision(item.task_id, true)} disabled={loading}>
                    Approve step
                  </button>
                  <button type="button" onClick={() => handleDelegationStepDecision(item.task_id, false)} disabled={loading}>
                    Reject
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </div>
        <div className="tool-panel">
          <h3>Style guides</h3>
          <input
            value={styleGuideTitle}
            onChange={(event) => setStyleGuideTitle(event.target.value)}
            placeholder="title"
            disabled={loading}
          />
          <select value={styleGuideType} onChange={(event) => setStyleGuideType(event.target.value)} disabled={loading}>
            <option value="style">Style</option>
            <option value="conventions">Conventions</option>
            <option value="architecture">Architecture</option>
          </select>
          <textarea
            rows={4}
            value={styleGuideContent}
            onChange={(event) => setStyleGuideContent(event.target.value)}
            disabled={loading}
          />
          <div className="button-row">
            <button type="button" onClick={handleSaveStyleGuide} disabled={!token || !selectedWorkspaceId || loading}>
              {editingGuideId ? "Update guide" : "Create guide"}
            </button>
            {editingGuideId ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setEditingGuideId("");
                  setStyleGuideTitle("API conventions");
                  setStyleGuideType("style");
                  setStyleGuideContent("Use snake_case for Python modules and keep route handlers thin.");
                }}
                disabled={loading}
              >
                New guide
              </button>
            ) : null}
          </div>
          {styleGuides.length === 0 ? (
            <p className="muted small">No style guides yet.</p>
          ) : (
            styleGuides.map((guide) => (
              <button
                key={guide.guide_id}
                type="button"
                className="file-item"
                onClick={() => handleEditStyleGuide(guide)}
                disabled={loading}
              >
                {guide.title} ({guide.guide_type})
              </button>
            ))
          )}
        </div>
        <div className="tool-panel">
          <h3>Session grants</h3>
          <p className="muted small">Grant workspace members view or delegate access to your session.</p>
          {sessionGrants.length === 0 ? <p className="muted small">No session grants yet.</p> : null}
          <ul className="small">
            {sessionGrants.map((grant) => (
              <li key={grant.grant_id}>
                {grant.granted_to_user_id} · {grant.session_id} · {grant.access_level}
              </li>
            ))}
          </ul>
          <input
            value={grantUserId}
            onChange={(event) => setGrantUserId(event.target.value)}
            placeholder="grant to user id"
            disabled={loading}
          />
          <select value={grantAccessLevel} onChange={(event) => setGrantAccessLevel(event.target.value)} disabled={loading}>
            <option value="view">View</option>
            <option value="delegate">Delegate</option>
          </select>
          <button type="button" onClick={handleCreateSessionGrant} disabled={!token || !selectedWorkspaceId || !sessionId || loading}>
            Grant session access
          </button>
        </div>
        <div className="tool-panel">
          <h3>Audit log</h3>
          <ul className="activity-list">
            {auditEvents.length === 0 ? <li className="muted">No events yet.</li> : null}
            {auditEvents.map((event) => (
              <li key={event.event_id}>
                {event.event_type} · {event.resource_type}/{event.resource_id}
              </li>
            ))}
          </ul>
          <h4 className="small">Live events</h4>
          <ul className="activity-list">
            {liveEvents.length === 0 ? <li className="muted">Waiting for team SSE…</li> : null}
            {liveEvents.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

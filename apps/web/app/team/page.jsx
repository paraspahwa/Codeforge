"use client";

import { useEffect, useMemo, useState } from "react";

import {
  addTeamWorkspaceMember,
  createTeamDelegation,
  createTeamWorkspace,
  executeTeamDelegation,
  getProjectKnowledge,
  listSessions,
  listTeamDelegations,
  listTeamWorkspaces,
  queryProjectKnowledge,
  rebuildProjectKnowledge,
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
  const [loading, setLoading] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("Core team");
  const [workspaceDescription, setWorkspaceDescription] = useState("Shared startup workspace");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("member");

  const [delegationRole, setDelegationRole] = useState("reviewer");
  const [delegationTask, setDelegationTask] = useState("Review recent changes and summarize risks");
  const [delegationPriority, setDelegationPriority] = useState("normal");

  const selectedWorkspace = useMemo(
    () => workspaces.find((entry) => entry.workspace_id === selectedWorkspaceId) || null,
    [selectedWorkspaceId, workspaces],
  );

  async function refreshTeamData(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const [nextWorkspaces, nextDelegations, nextSessions] = await Promise.all([
      listTeamWorkspaces(activeToken),
      listTeamDelegations(activeToken, selectedWorkspaceId || null),
      listSessions(activeToken),
    ]);
    setWorkspaces(nextWorkspaces.workspaces || []);
    setDelegations(nextDelegations.delegations || []);
    setSessions(nextSessions);
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
      });
      toast.push(`Delegation ${delegation.task_id} queued`, "success");
      await refreshTeamData(token);
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

  if (ready && !token) {
    return (
      <section className="panel empty-state">
        <h2>Team</h2>
        <p className="small">Login from the top bar to manage workspaces, knowledge, and delegations.</p>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h2>Team platform</h2>
        <p className="small">
          Shared workspaces, project knowledge indexing, and delegated agent tasks for collaborative workflows.
        </p>
      </section>

      <div className="grid">
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

        <section className="panel">
          <h3>Project knowledge</h3>
          <label className="small" htmlFor="teamSession">
            Session
          </label>
          <select id="teamSession" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {session.session_id}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleRebuildKnowledge} disabled={loading || !sessionId}>
            Rebuild knowledge index
          </button>
          {knowledge ? (
            <p className="small">
              {knowledge.summary} · {knowledge.items?.length || 0} files indexed
            </p>
          ) : (
            <p className="small">No knowledge index for this session yet.</p>
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
      </div>

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
                {item.status === "queued" || item.status === "failed" ? (
                  <button type="button" className="ghost-btn inline-btn" onClick={() => handleExecuteDelegation(item.task_id)} disabled={loading}>
                    Execute
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

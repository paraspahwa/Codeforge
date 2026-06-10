const vscode = acquireVsCodeApi();

const state = {
  baseUrl: "http://127.0.0.1:8000",
  userId: "dev-user",
  workspacePath: "",
  currentFile: "",
  selectionPreview: "",
  selectionLineCount: 0,
  currentSessionId: "",
  sessions: [],
  events: [],
  chatMessages: [],
  loopVerify: "pytest -q",
  loopSummary: "",
  planTargets: "",
  activePlanId: "",
  workflowOutput: "",
  autoMode: false,
  proposalId: "",
  proposalStatus: "",
  proposal: null,
  diffPreview: null,
  approvalRequest: null,
  usage: null,
  busy: false,
  lastError: "",
  lastIntent: "",
  lastModel: "",
  lastRoutingReason: "",
  confidenceScore: null,
  confidenceLabel: "",
  reviewRequired: false,
  routingTier: "",
  fallbackUsed: false,
  prompt: "",
  panelTab: "chat",
  teamWorkspaces: [],
  teamDelegations: [],
  teamAuditEvents: [],
  teamOutput: "",
  teamWorkspaceName: "Core team",
  teamKnowledgeQuery: "",
  teamMemberUserId: "",
  teamDelegationTask: "Review recent changes",
  teamStyleGuides: [],
  teamSessionGrants: [],
  teamGrantUserId: "",
  teamGrantAccessLevel: "delegate",
  teamStyleGuideTitle: "API conventions",
  teamStyleGuideType: "style",
  teamStyleGuideContent: "Use snake_case for Python modules and keep handlers thin.",
  teamLiveEvents: [],
  oidcEnabled: false,
  oidcAuthMessage: "",
  coworkPlans: [],
  coworkRuns: [],
  coworkJobs: [],
  coworkOutput: "",
  coworkShellCommand: "dir",
  coworkExtractPath: "",
  coworkBrowserUrl: "https://example.com",
};

function formatRoutingSignal(state) {
  if (!state.confidenceLabel && state.confidenceScore == null) {
    return "";
  }
  const score = Math.round((state.confidenceScore || 0) * 100);
  const review = state.reviewRequired ? " · review required" : "";
  const tier = state.routingTier ? ` · tier ${state.routingTier}` : "";
  const fallback = state.fallbackUsed ? " · fallback path" : "";
  return `Routing: ${state.lastIntent || "unknown"} via ${state.lastModel || "unknown"} · confidence ${state.confidenceLabel || "unknown"} ${score}%${review}${tier}${fallback}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function canWriteSession(session) {
  if (!session || session.access_source !== "granted") {
    return true;
  }
  return session.access_level === "delegate";
}

function sessionAllowsWrite(state) {
  const session = state.sessions.find((item) => item.session_id === state.currentSessionId);
  return canWriteSession(session);
}

function viewOnlySessionMessage(state) {
  const session = state.sessions.find((item) => item.session_id === state.currentSessionId);
  if (!session || canWriteSession(session)) {
    return "";
  }
  const owner = session.owner_user_id ? ` from ${session.owner_user_id}` : "";
  return `View-only access${owner}. Write actions are disabled.`;
}

function formatSessionListLabel(session) {
  if (!session || session.access_source !== "granted") {
    return session?.session_id || "";
  }
  const owner = session.owner_user_id ? ` from ${session.owner_user_id}` : "";
  return `${session.session_id} (granted ${session.access_level || "view"}${owner})`;
}

function render() {
  const app = document.getElementById("app");
  const proposalPatch = state.diffPreview?.patch || state.proposal?.patch_preview || "";
  const proposalTarget = state.proposal?.target_file || state.diffPreview?.file || "pending target";
  const chatTab = state.panelTab === "chat";
  const teamTab = state.panelTab === "team";
  const coworkTab = state.panelTab === "cowork";

  app.innerHTML = `
    <div class="shell">
      <nav class="tab-bar">
        <button class="tab ${chatTab ? "active" : ""}" data-tab="chat">Chat</button>
        <button class="tab ${teamTab ? "active" : ""}" data-tab="team">Team</button>
        <button class="tab ${coworkTab ? "active" : ""}" data-tab="cowork">Cowork</button>
      </nav>

      <section class="card controls">
        <h1>CodeForge</h1>
        <div class="grid ${state.oidcEnabled ? "one-up" : "two-up"}">
          <label>
            <span>API URL</span>
            <input id="baseUrl" value="${escapeHtml(state.baseUrl)}" ${state.busy ? "disabled" : ""} />
          </label>
          ${state.oidcEnabled ? "" : `
          <label>
            <span>User</span>
            <input id="userId" value="${escapeHtml(state.userId)}" ${state.busy ? "disabled" : ""} />
          </label>
          `}
        </div>
        <div class="grid two-up">
          <label>
            <span>Workspace</span>
            <input id="projectPath" value="${escapeHtml(state.workspacePath)}" ${state.busy ? "disabled" : ""} />
          </label>
          <label>
            <span>Current file</span>
            <input value="${escapeHtml(state.currentFile)}" disabled />
          </label>
        </div>
        <div class="actions">
          ${state.oidcEnabled ? `<button data-action="loginOidc" ${state.busy ? "disabled" : ""}>Sign in with SSO</button>` : `<button data-action="login" ${state.busy ? "disabled" : ""}>Login</button>`}
          <button data-action="createSession" ${state.busy ? "disabled" : ""}>New Session</button>
          <button data-action="refresh" ${state.busy ? "disabled" : ""}>Refresh</button>
        </div>
        ${state.oidcEnabled ? `
        <div class="grid two-up">
          <label>
            <span>OIDC code</span>
            <input id="oidcCode" placeholder="paste authorization code" ${state.busy ? "disabled" : ""} />
          </label>
          <div class="actions">
            <button data-action="completeOidc" ${state.busy ? "disabled" : ""}>Complete SSO</button>
          </div>
        </div>
        ${state.oidcAuthMessage ? `<p class="muted">${escapeHtml(state.oidcAuthMessage)}</p>` : ""}
        ` : ""}
        <div class="status">
          <span>${state.currentSessionId ? `Session ${escapeHtml(state.currentSessionId)}` : "No session"}</span>
          <span>${state.usage ? `Usage ${state.usage.requests_used_in_period ?? state.usage.total_requests}/${state.usage.request_limit} (${state.usage.requests_remaining} left)` : "Usage unavailable"}</span>
        </div>
        <div class="context-strip">
          <div class="context-chip">
            <span>Editor context</span>
            <strong>${escapeHtml(state.currentFile || "No active file")}</strong>
          </div>
          <div class="context-chip">
            <span>Selection</span>
            <strong>${state.selectionLineCount ? `${state.selectionLineCount} line${state.selectionLineCount === 1 ? "" : "s"}` : "No selection"}</strong>
          </div>
        </div>
        ${state.selectionPreview ? `<pre class="snippet">${escapeHtml(state.selectionPreview)}</pre>` : ""}
      </section>

      ${teamTab ? `
      <section class="card">
        <h2>Team</h2>
        <div class="actions">
          <button data-action="teamRefresh" ${state.busy ? "disabled" : ""}>Refresh workspaces</button>
          <button data-action="teamRebuildKb" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Rebuild knowledge</button>
        </div>
        <div class="grid two-up">
          <label>
            <span>New workspace</span>
            <input id="teamWorkspaceName" value="${escapeHtml(state.teamWorkspaceName)}" ${state.busy ? "disabled" : ""} />
          </label>
          <label>
            <span>Knowledge query</span>
            <input id="teamKnowledgeQuery" value="${escapeHtml(state.teamKnowledgeQuery)}" placeholder="search indexed files" ${state.busy ? "disabled" : ""} />
          </label>
        </div>
        <div class="actions">
          <button data-action="teamCreateWorkspace" ${state.busy ? "disabled" : ""}>Create workspace</button>
          <button data-action="teamQueryKnowledge" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Query knowledge</button>
          <button data-action="teamShareSession" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Share session</button>
          <button data-action="teamExportSession" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Export JSON</button>
        </div>
        <label>
          <span>Add member user ID</span>
          <input id="teamMemberUserId" value="${escapeHtml(state.teamMemberUserId)}" ${state.busy ? "disabled" : ""} />
        </label>
        <button data-action="teamAddMember" ${state.busy ? "disabled" : ""}>Add member to first workspace</button>
        <label>
          <span>Delegation task</span>
          <input id="teamDelegationTask" value="${escapeHtml(state.teamDelegationTask)}" ${state.busy ? "disabled" : ""} />
        </label>
        <div class="grid two-up">
          <label>
            <span>Orchestration mode</span>
            <select id="teamDelegationMode" ${state.busy ? "disabled" : ""}>
              <option value="single" ${state.teamDelegationMode === "single" ? "selected" : ""}>Single</option>
              <option value="sequential" ${state.teamDelegationMode === "sequential" ? "selected" : ""}>Sequential</option>
              <option value="supervisor" ${state.teamDelegationMode === "supervisor" ? "selected" : ""}>Supervisor</option>
            </select>
          </label>
          <label>
            <span>Agent roles (comma-separated)</span>
            <input id="teamDelegationRoles" value="${escapeHtml(state.teamDelegationRoles || "")}" ${state.busy ? "disabled" : ""} />
          </label>
        </div>
        <label>
          <input id="teamRequireStepApproval" type="checkbox" ${state.teamRequireStepApproval ? "checked" : ""} ${state.busy ? "disabled" : ""} />
          Require approval between orchestration steps
        </label>
        <button data-action="teamCreateDelegation" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Queue delegation</button>
        <div class="session-list">
          ${state.teamWorkspaces.length === 0 ? '<p class="muted">No workspaces loaded. Refresh after login.</p>' : state.teamWorkspaces.map((workspace) => `
            <div class="session-item">
              <strong>${escapeHtml(workspace.workspace_id)}</strong>
              <span>${escapeHtml(workspace.name)} · ${workspace.members?.length || 0} members</span>
            </div>
          `).join("")}
        </div>
        <h2>Delegations</h2>
        <div class="session-list">
          ${state.teamDelegations.length === 0 ? '<p class="muted">No delegations.</p>' : state.teamDelegations.slice(0, 8).map((item) => `
            <div class="session-item">
              <strong>${escapeHtml(item.assigned_role)}</strong>
              <span>${escapeHtml(item.status)} · ${escapeHtml((item.task || "").slice(0, 80))}</span>
              <div class="actions">
                ${item.status === "queued" || item.status === "failed" ? `<button data-delegation-id="${escapeHtml(item.task_id)}">Execute</button>` : ""}
                ${item.status === "awaiting_approval" ? `
                  <button data-approve-id="${escapeHtml(item.task_id)}">Approve</button>
                  <button data-reject-id="${escapeHtml(item.task_id)}">Reject</button>
                ` : ""}
              </div>
            </div>
          `).join("")}
        </div>
        <h2>Session grants</h2>
        <div class="session-list">
          ${state.teamSessionGrants.length === 0 ? '<p class="muted">No session grants.</p>' : state.teamSessionGrants.slice(0, 8).map((grant) => `
            <div class="session-item">
              <strong>${escapeHtml(grant.granted_to_user_id)}</strong>
              <span>${escapeHtml(grant.session_id)} · ${escapeHtml(grant.access_level)}</span>
            </div>
          `).join("")}
        </div>
        <div class="grid two-up">
          <label>
            <span>Grant to user ID</span>
            <input id="teamGrantUserId" value="${escapeHtml(state.teamGrantUserId)}" ${state.busy ? "disabled" : ""} />
          </label>
          <label>
            <span>Access level</span>
            <select id="teamGrantAccessLevel" ${state.busy ? "disabled" : ""}>
              <option value="view" ${state.teamGrantAccessLevel === "view" ? "selected" : ""}>view</option>
              <option value="delegate" ${state.teamGrantAccessLevel === "delegate" ? "selected" : ""}>delegate</option>
            </select>
          </label>
        </div>
        <button data-action="teamCreateSessionGrant" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Grant session access</button>
        <h2>Style guides</h2>
        <div class="grid two-up">
          <label>
            <span>Title</span>
            <input id="teamStyleGuideTitle" value="${escapeHtml(state.teamStyleGuideTitle)}" ${state.busy ? "disabled" : ""} />
          </label>
          <label>
            <span>Type</span>
            <select id="teamStyleGuideType" ${state.busy ? "disabled" : ""}>
              <option value="style" ${state.teamStyleGuideType === "style" ? "selected" : ""}>style</option>
              <option value="conventions" ${state.teamStyleGuideType === "conventions" ? "selected" : ""}>conventions</option>
              <option value="architecture" ${state.teamStyleGuideType === "architecture" ? "selected" : ""}>architecture</option>
            </select>
          </label>
        </div>
        <label>
          <span>Content</span>
          <textarea id="teamStyleGuideContent" rows="3" ${state.busy ? "disabled" : ""}>${escapeHtml(state.teamStyleGuideContent)}</textarea>
        </label>
        <button data-action="teamCreateStyleGuide" ${state.busy ? "disabled" : ""}>Save style guide</button>
        <div class="session-list">
          ${(state.teamStyleGuides || []).length === 0 ? '<p class="muted">No style guides.</p>' : state.teamStyleGuides.slice(0, 6).map((guide) => `
            <div class="session-item">
              <strong>${escapeHtml(guide.title)}</strong>
              <span>${escapeHtml(guide.guide_type)} · ${escapeHtml((guide.content || "").slice(0, 100))}</span>
            </div>
          `).join("")}
        </div>
        <h2>Audit</h2>
        <div class="session-list">
          ${state.teamAuditEvents.length === 0 ? '<p class="muted">No audit events.</p>' : state.teamAuditEvents.slice(0, 6).map((event) => `
            <div class="session-item">
              <strong>${escapeHtml(event.event_type)}</strong>
              <span>${escapeHtml(event.resource_type)}/${escapeHtml(event.resource_id)}</span>
            </div>
          `).join("")}
        </div>
        ${state.teamLiveEvents.length ? `<pre class="diff-view">${escapeHtml(state.teamLiveEvents.join("\n"))}</pre>` : ""}
        ${state.teamOutput ? `<pre class="diff-view">${escapeHtml(state.teamOutput)}</pre>` : ""}
      </section>
      ` : ""}

      ${coworkTab ? `
      <section class="card">
        <h2>Cowork</h2>
        <div class="actions">
          <button data-action="coworkRefresh" ${state.busy ? "disabled" : ""}>Refresh plans/runs</button>
        </div>
        <div class="grid two-up">
          <label>
            <span>Shell command</span>
            <input id="coworkShellCommand" value="${escapeHtml(state.coworkShellCommand)}" ${state.busy ? "disabled" : ""} />
          </label>
          <label>
            <span>Extract path</span>
            <input id="coworkExtractPath" value="${escapeHtml(state.coworkExtractPath)}" placeholder="README.md" ${state.busy ? "disabled" : ""} />
          </label>
        </div>
        <label>
          <span>Browser URL</span>
          <input id="coworkBrowserUrl" value="${escapeHtml(state.coworkBrowserUrl)}" ${state.busy ? "disabled" : ""} />
        </label>
        <div class="actions">
          <button data-action="coworkShell" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Run shell plan</button>
          <button data-action="coworkExtract" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Extract file</button>
          <button data-action="coworkBrowser" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Browser task</button>
          <button data-action="coworkRefreshJobs" ${state.busy ? "disabled" : ""}>Refresh jobs</button>
        </div>
        <div class="session-list">
          ${state.coworkJobs.length === 0 ? '<p class="muted">No jobs loaded.</p>' : state.coworkJobs.slice(0, 8).map((job) => `
            <button class="session-item job-item" data-job-id="${escapeHtml(job.job_id)}" data-job-enabled="${job.enabled ? "1" : "0"}">
              <strong>${escapeHtml(job.title)}</strong>
              <span>${escapeHtml(job.trigger_type)} · enabled=${job.enabled ? "yes" : "no"}</span>
            </button>
          `).join("")}
        </div>
        <div class="grid split">
          <div>
            <h2>Plans</h2>
            <div class="session-list">
              ${state.coworkPlans.length === 0 ? '<p class="muted">No plans yet.</p>' : state.coworkPlans.slice(0, 10).map((plan) => `
                <button class="session-item plan-item" data-plan-id="${escapeHtml(plan.plan_id)}">
                  <strong>${escapeHtml(plan.title)}</strong>
                  <span>${escapeHtml(plan.task_type)} · ${escapeHtml(plan.status)}</span>
                </button>
              `).join("")}
            </div>
          </div>
          <div>
            <h2>Recent runs</h2>
            <div class="session-list">
              ${state.coworkRuns.length === 0 ? '<p class="muted">No runs yet.</p>' : state.coworkRuns.slice(0, 8).map((run) => `
                <div class="session-item">
                  <strong>${escapeHtml(run.run_id)}</strong>
                  <span>${escapeHtml(run.status)} · ${escapeHtml((run.summary || "").slice(0, 120))}</span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
        ${state.coworkOutput ? `<pre class="diff-view">${escapeHtml(state.coworkOutput)}</pre>` : ""}
      </section>
      ` : ""}

      ${chatTab ? `
      <section class="card prompt-card">
        ${viewOnlySessionMessage(state) ? `<p class="hint">${escapeHtml(viewOnlySessionMessage(state))}</p>` : ""}
        <label>
          <span>Prompt</span>
          <textarea id="prompt" rows="7" ${state.busy || !sessionAllowsWrite(state) ? "disabled" : ""}>${escapeHtml(state.prompt)}</textarea>
        </label>
        <div class="actions">
          <button data-action="sendPrompt" ${state.busy || !sessionAllowsWrite(state) ? "disabled" : ""}>Send</button>
          <button data-action="approve" ${state.busy || !state.proposalId || !sessionAllowsWrite(state) ? "disabled" : ""}>Approve</button>
          <button data-action="reject" ${state.busy || !state.proposalId ? "disabled" : ""}>Reject</button>
        </div>
        <div class="meta">
          <span>${escapeHtml(state.lastIntent || "")}</span>
          <span>${escapeHtml(state.lastModel || "")}</span>
          <span>${escapeHtml(state.proposalId ? `${state.proposalId}:${state.proposalStatus || "pending"}` : "")}</span>
        </div>
        ${formatRoutingSignal(state) ? `<div class="routing-signal ${state.reviewRequired ? "routing-signal-review" : ""}">${escapeHtml(formatRoutingSignal(state))}${state.reviewRequired ? "<strong>Human review recommended before apply.</strong>" : ""}</div>` : ""}
        <p class="hint">${escapeHtml(state.lastRoutingReason || "")}</p>
        ${state.lastError ? `<p class="error">${escapeHtml(state.lastError)}</p>` : ""}
      </section>

      <section class="card">
        <h2>Workflows</h2>
        <div class="actions">
          <button data-action="compactWorkflow" ${state.busy || !state.currentSessionId || !sessionAllowsWrite(state) ? "disabled" : ""}>Compact</button>
          <button data-action="ultrareviewWorkflow" ${state.busy || !state.currentSessionId || !sessionAllowsWrite(state) ? "disabled" : ""}>Ultrareview</button>
          <button data-action="forkSession" ${state.busy || !state.currentSessionId || !sessionAllowsWrite(state) ? "disabled" : ""}>Fork</button>
        </div>
        <input id="planTargets" value="${escapeHtml(state.planTargets)}" placeholder="plan targets" ${state.busy ? "disabled" : ""} />
        <label class="hint">
          <input id="autoMode" type="checkbox" ${state.autoMode ? "checked" : ""} ${state.busy ? "disabled" : ""} />
          Auto mode
        </label>
        <div class="actions">
          <button data-action="createWorkflowPlan" ${state.busy || !state.currentSessionId || !sessionAllowsWrite(state) ? "disabled" : ""}>Plan</button>
          <button data-action="executeWorkflowPlan" ${state.busy || !state.activePlanId || !sessionAllowsWrite(state) ? "disabled" : ""}>Run Plan</button>
          <button data-action="rollbackWorkflowPlan" ${state.busy || !state.activePlanId || !sessionAllowsWrite(state) ? "disabled" : ""}>Rollback</button>
        </div>
        ${state.activePlanId ? `<p class="hint">Plan: ${escapeHtml(state.activePlanId)}</p>` : ""}
        ${state.workflowOutput ? `<pre class="diff-view">${escapeHtml(state.workflowOutput)}</pre>` : ""}
      </section>

      <section class="card">
        <h2>Verify / Fix Loop</h2>
        <div class="actions">
          <input id="loopVerify" value="${escapeHtml(state.loopVerify)}" ${state.busy ? "disabled" : ""} />
          <button data-action="runAgentLoop" ${state.busy || !state.currentSessionId || !sessionAllowsWrite(state) ? "disabled" : ""}>Run Loop</button>
        </div>
        ${state.loopSummary ? `<p class="hint">${escapeHtml(state.loopSummary)}</p>` : ""}
      </section>

      <section class="grid split">
        <div class="card">
          <h2>Sessions</h2>
          <div class="session-list">
            ${state.sessions.length === 0 ? '<p class="muted">No sessions yet.</p>' : state.sessions.map((session) => `
              <button class="session-item ${session.session_id === state.currentSessionId ? "active" : ""}" data-session-id="${escapeHtml(session.session_id)}">
                <strong>${escapeHtml(formatSessionListLabel(session))}</strong>
                <span>${escapeHtml(session.project_path)}</span>
              </button>
            `).join("")}
          </div>
        </div>
        <div class="card">
          <h2>Proposal</h2>
          ${state.proposalId ? `
            <div class="proposal-meta">
              <span>${escapeHtml(proposalTarget)}</span>
              <span>${escapeHtml(`${state.proposalId}:${state.proposalStatus || "pending"}`)}</span>
            </div>
          ` : '<p class="muted">No proposal in the current session yet.</p>'}
          ${state.approvalRequest?.message ? `<p class="hint">${escapeHtml(state.approvalRequest.message)}</p>` : ""}
          <div class="actions compact-actions">
            <button data-action="openProposalTarget" ${state.busy || !state.proposalId ? "disabled" : ""}>Open Target</button>
            <button data-action="refreshProposalDiff" ${state.busy || !state.proposalId || !state.currentSessionId ? "disabled" : ""}>Git Diff</button>
          </div>
          ${proposalPatch ? `<pre class="diff-view">${escapeHtml(proposalPatch)}</pre>` : ""}
        </div>
      </section>

      <section class="grid split">
        <div class="card">
          <h2>Session Messages</h2>
          <div class="session-list">
            ${state.chatMessages.length === 0 ? '<p class="muted">No saved messages for this session.</p>' : state.chatMessages.slice(-8).map((message) => `
              <div class="session-item">
                <strong>${escapeHtml(message.role)}</strong>
                <span>${escapeHtml((message.content || "").slice(0, 180))}</span>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="card">
          <h2>Activity</h2>
          <pre class="log">${escapeHtml(state.events.join("\n"))}</pre>
        </div>
      </section>
      ` : ""}
    </div>
  `;

  document.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", () => {
      const action = element.getAttribute("data-action");
      if (action === "login") {
        vscode.postMessage({
          type: "login",
          baseUrl: document.getElementById("baseUrl").value.trim(),
          userId: document.getElementById("userId").value.trim(),
        });
      }
      if (action === "loginOidc") {
        vscode.postMessage({
          type: "loginOidc",
          baseUrl: document.getElementById("baseUrl").value.trim(),
        });
      }
      if (action === "completeOidc") {
        vscode.postMessage({
          type: "completeOidc",
          code: document.getElementById("oidcCode").value.trim(),
        });
      }
      if (action === "createSession") {
        vscode.postMessage({
          type: "createSession",
          projectPath: document.getElementById("projectPath").value.trim(),
        });
      }
      if (action === "refresh") {
        vscode.postMessage({ type: "refresh" });
      }
      if (action === "sendPrompt") {
        vscode.postMessage({
          type: "sendPrompt",
          prompt: document.getElementById("prompt").value.trim(),
        });
      }
      if (action === "approve") {
        vscode.postMessage({ type: "proposalDecision", action: "approve" });
      }
      if (action === "reject") {
        vscode.postMessage({ type: "proposalDecision", action: "reject" });
      }
      if (action === "openProposalTarget") {
        vscode.postMessage({ type: "openProposalTarget" });
      }
      if (action === "refreshProposalDiff") {
        vscode.postMessage({ type: "refreshProposalDiff" });
      }
      if (action === "runAgentLoop") {
        vscode.postMessage({
          type: "runAgentLoop",
          verifyCommand: document.getElementById("loopVerify").value.trim(),
        });
      }
      if (action === "compactWorkflow") {
        vscode.postMessage({ type: "compactWorkflow" });
      }
      if (action === "ultrareviewWorkflow") {
        vscode.postMessage({ type: "ultrareviewWorkflow" });
      }
      if (action === "forkSession") {
        vscode.postMessage({ type: "forkSession" });
      }
      if (action === "createWorkflowPlan") {
        vscode.postMessage({
          type: "createWorkflowPlan",
          targets: document.getElementById("planTargets").value.trim(),
        });
      }
      if (action === "executeWorkflowPlan") {
        vscode.postMessage({
          type: "executeWorkflowPlan",
          prompt: document.getElementById("prompt").value.trim(),
          autoMode: document.getElementById("autoMode").checked,
        });
      }
      if (action === "rollbackWorkflowPlan") {
        vscode.postMessage({ type: "rollbackWorkflowPlan" });
      }
      if (action === "teamRefresh") {
        vscode.postMessage({ type: "teamRefresh" });
      }
      if (action === "teamCreateWorkspace") {
        vscode.postMessage({
          type: "teamCreateWorkspace",
          name: document.getElementById("teamWorkspaceName").value.trim(),
        });
      }
      if (action === "teamRebuildKb") {
        vscode.postMessage({ type: "teamRebuildKb" });
      }
      if (action === "teamQueryKnowledge") {
        vscode.postMessage({
          type: "teamQueryKnowledge",
          query: document.getElementById("teamKnowledgeQuery").value.trim(),
        });
      }
      if (action === "teamShareSession") {
        vscode.postMessage({ type: "teamShareSession" });
      }
      if (action === "teamExportSession") {
        vscode.postMessage({ type: "teamExportSession" });
      }
      if (action === "teamAddMember") {
        vscode.postMessage({
          type: "teamAddMember",
          memberUserId: document.getElementById("teamMemberUserId").value.trim(),
        });
      }
      if (action === "teamCreateDelegation") {
        vscode.postMessage({
          type: "teamCreateDelegation",
          task: document.getElementById("teamDelegationTask").value.trim(),
          mode: document.getElementById("teamDelegationMode").value,
          roles: document.getElementById("teamDelegationRoles").value.trim(),
          requireStepApproval: document.getElementById("teamRequireStepApproval").checked,
        });
      }
      if (action === "teamCreateSessionGrant") {
        vscode.postMessage({
          type: "teamCreateSessionGrant",
          grantedToUserId: document.getElementById("teamGrantUserId").value.trim(),
          accessLevel: document.getElementById("teamGrantAccessLevel").value,
        });
      }
      if (action === "teamCreateStyleGuide") {
        vscode.postMessage({
          type: "teamCreateStyleGuide",
          title: document.getElementById("teamStyleGuideTitle").value.trim(),
          guideType: document.getElementById("teamStyleGuideType").value,
          content: document.getElementById("teamStyleGuideContent").value.trim(),
        });
      }
      if (action === "coworkRefresh") {
        vscode.postMessage({ type: "coworkRefresh" });
      }
      if (action === "coworkShell") {
        vscode.postMessage({
          type: "coworkShell",
          command: document.getElementById("coworkShellCommand").value.trim(),
        });
      }
      if (action === "coworkExtract") {
        vscode.postMessage({
          type: "coworkExtract",
          sourcePath: document.getElementById("coworkExtractPath").value.trim(),
        });
      }
      if (action === "coworkBrowser") {
        vscode.postMessage({
          type: "coworkBrowser",
          url: document.getElementById("coworkBrowserUrl").value.trim(),
        });
      }
      if (action === "coworkRefreshJobs") {
        vscode.postMessage({ type: "coworkRefreshJobs" });
      }
    });
  });

  document.querySelectorAll("[data-delegation-id]").forEach((element) => {
    element.addEventListener("click", () => {
      vscode.postMessage({
        type: "teamExecuteDelegation",
        taskId: element.getAttribute("data-delegation-id"),
      });
    });
  });

  document.querySelectorAll("[data-approve-id]").forEach((element) => {
    element.addEventListener("click", () => {
      vscode.postMessage({
        type: "teamApproveDelegation",
        taskId: element.getAttribute("data-approve-id"),
        approved: true,
      });
    });
  });

  document.querySelectorAll("[data-reject-id]").forEach((element) => {
    element.addEventListener("click", () => {
      vscode.postMessage({
        type: "teamApproveDelegation",
        taskId: element.getAttribute("data-reject-id"),
        approved: false,
      });
    });
  });

  document.querySelectorAll("[data-job-id]").forEach((element) => {
    element.addEventListener("click", () => {
      vscode.postMessage({
        type: "coworkToggleJob",
        jobId: element.getAttribute("data-job-id"),
        enabled: element.getAttribute("data-job-enabled") !== "1",
      });
    });
  });

  document.querySelectorAll("[data-tab]").forEach((element) => {
    element.addEventListener("click", () => {
      vscode.postMessage({
        type: "setPanelTab",
        tab: element.getAttribute("data-tab"),
      });
    });
  });

  document.querySelectorAll("[data-plan-id]").forEach((element) => {
    element.addEventListener("click", () => {
      vscode.postMessage({
        type: "coworkRunPlan",
        planId: element.getAttribute("data-plan-id"),
        approved: true,
      });
    });
  });

  document.querySelectorAll("[data-session-id]").forEach((element) => {
    element.addEventListener("click", () => {
      vscode.postMessage({
        type: "selectSession",
        sessionId: element.getAttribute("data-session-id"),
      });
    });
  });
}

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "state") {
    Object.assign(state, message.payload || {});
    render();
  }
  if (message.type === "seedPrompt") {
    state.prompt = message.payload?.prompt || "";
    render();
  }
});

render();
vscode.postMessage({ type: "ready" });
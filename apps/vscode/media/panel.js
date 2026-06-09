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
  prompt: "",
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  const app = document.getElementById("app");
  const proposalPatch = state.diffPreview?.patch || state.proposal?.patch_preview || "";
  const proposalTarget = state.proposal?.target_file || state.diffPreview?.file || "pending target";
  app.innerHTML = `
    <div class="shell">
      <section class="card controls">
        <h1>CodeForge</h1>
        <div class="grid two-up">
          <label>
            <span>API URL</span>
            <input id="baseUrl" value="${escapeHtml(state.baseUrl)}" ${state.busy ? "disabled" : ""} />
          </label>
          <label>
            <span>User</span>
            <input id="userId" value="${escapeHtml(state.userId)}" ${state.busy ? "disabled" : ""} />
          </label>
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
          <button data-action="login" ${state.busy ? "disabled" : ""}>Login</button>
          <button data-action="createSession" ${state.busy ? "disabled" : ""}>New Session</button>
          <button data-action="refresh" ${state.busy ? "disabled" : ""}>Refresh</button>
        </div>
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

      <section class="card prompt-card">
        <label>
          <span>Prompt</span>
          <textarea id="prompt" rows="7" ${state.busy ? "disabled" : ""}>${escapeHtml(state.prompt)}</textarea>
        </label>
        <div class="actions">
          <button data-action="sendPrompt" ${state.busy ? "disabled" : ""}>Send</button>
          <button data-action="approve" ${state.busy || !state.proposalId ? "disabled" : ""}>Approve</button>
          <button data-action="reject" ${state.busy || !state.proposalId ? "disabled" : ""}>Reject</button>
        </div>
        <div class="meta">
          <span>${escapeHtml(state.lastIntent || "")}</span>
          <span>${escapeHtml(state.lastModel || "")}</span>
          <span>${escapeHtml(state.proposalId ? `${state.proposalId}:${state.proposalStatus || "pending"}` : "")}</span>
        </div>
        <p class="hint">${escapeHtml(state.lastRoutingReason || "")}</p>
        ${state.lastError ? `<p class="error">${escapeHtml(state.lastError)}</p>` : ""}
      </section>

      <section class="card">
        <h2>Verify / Fix Loop</h2>
        <div class="actions">
          <input id="loopVerify" value="${escapeHtml(state.loopVerify)}" ${state.busy ? "disabled" : ""} />
          <button data-action="runAgentLoop" ${state.busy || !state.currentSessionId ? "disabled" : ""}>Run Loop</button>
        </div>
        ${state.loopSummary ? `<p class="hint">${escapeHtml(state.loopSummary)}</p>` : ""}
      </section>

      <section class="grid split">
        <div class="card">
          <h2>Sessions</h2>
          <div class="session-list">
            ${state.sessions.length === 0 ? '<p class="muted">No sessions yet.</p>' : state.sessions.map((session) => `
              <button class="session-item ${session.session_id === state.currentSessionId ? "active" : ""}" data-session-id="${escapeHtml(session.session_id)}">
                <strong>${escapeHtml(session.session_id)}</strong>
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
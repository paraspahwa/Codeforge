const DEFAULT_API_BASE_URL = process.env.CODEFORGE_API_BASE_URL || "http://127.0.0.1:8000";

function normalizeBaseUrl(baseUrl = DEFAULT_API_BASE_URL) {
  return String(baseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.detail === "string") {
        detail = errorBody.detail;
      }
    } catch {
      // Fall back to the HTTP status when the body is not JSON.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function devLogin(baseUrl, userId) {
  return requestJson(baseUrl, "/api/v1/auth/dev-login", {
    method: "POST",
    body: { user_id: userId },
  });
}

export async function listSessions(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/sessions", { token });
}

export async function createSession(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/sessions", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listMessages(baseUrl, token, sessionId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/messages`, { token });
}

export async function sendMessage(baseUrl, token, sessionId, payload) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/messages`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listProposals(baseUrl, token, sessionId, limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) }).toString();
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/proposals?${query}`, { token });
}

export async function getProposal(baseUrl, token, sessionId, proposalId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/proposals/${proposalId}`, { token });
}

export async function runAgentLoop(baseUrl, token, sessionId, payload) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/agent/loop`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function forkSession(baseUrl, token, sessionId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/fork`, {
    method: "POST",
    token,
  });
}

export async function compactWorkflow(baseUrl, token, sessionId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/workflows/compact`, {
    method: "POST",
    token,
  });
}

export async function ultrareviewWorkflow(baseUrl, token, sessionId, payload = {}) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/workflows/ultrareview`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function createWorkflowPlan(baseUrl, token, sessionId, targets) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/workflows/plan`, {
    method: "POST",
    token,
    body: { targets },
  });
}

export async function executeWorkflowPlan(baseUrl, token, sessionId, planId, payload = {}) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/workflows/plan/${planId}/execute`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function rollbackWorkflowPlan(baseUrl, token, sessionId, planId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/workflows/plan/${planId}/rollback`, {
    method: "POST",
    token,
  });
}

export async function decideProposal(baseUrl, token, sessionId, proposalId, action) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/proposals/${proposalId}/decision`, {
    method: "POST",
    token,
    body: { action },
  });
}

export async function getFilePreview(baseUrl, token, sessionId, path) {
  const query = new URLSearchParams({ path }).toString();
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/files/preview?${query}`, { token });
}

export async function getFileContent(baseUrl, token, sessionId, path) {
  const query = new URLSearchParams({ path }).toString();
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/files/content?${query}`, { token });
}

export async function applyFile(baseUrl, token, sessionId, payload) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/files/apply`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getGitStatus(baseUrl, token, sessionId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/status`, { token });
}

export async function getGitDiff(baseUrl, token, sessionId, path) {
  const query = path ? `?${new URLSearchParams({ path }).toString()}` : "";
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/diff${query}`, { token });
}

export async function getGitLog(baseUrl, token, sessionId, limit = 10) {
  const query = new URLSearchParams({ limit: String(limit) }).toString();
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/log?${query}`, { token });
}

export async function stageGitFiles(baseUrl, token, sessionId, payload) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/stage`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function commitGitChanges(baseUrl, token, sessionId, message) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/commit`, {
    method: "POST",
    token,
    body: { message },
  });
}

export async function branchGitRepo(baseUrl, token, sessionId, payload) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/branch`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listGitWorktrees(baseUrl, token, sessionId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/worktree/list`, { token });
}

export async function createGitWorktree(baseUrl, token, sessionId, branch) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/worktree/create`, {
    method: "POST",
    token,
    body: { branch },
  });
}

export async function getGitMergeAssist(baseUrl, token, sessionId, targetBranch) {
  const query = new URLSearchParams({ target_branch: targetBranch }).toString();
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/merge-assist?${query}`, { token });
}

export async function getGitConflictGuide(baseUrl, token, sessionId, targetBranch) {
  const query = new URLSearchParams({ target_branch: targetBranch }).toString();
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/conflict-guide?${query}`, { token });
}

export async function applyGitConflictAssist(baseUrl, token, sessionId, payload) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/git/conflict-assist/apply`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function* streamShellCommand(baseUrl, token, sessionId, payload) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/sessions/${sessionId}/shell/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    let detail = `Shell command failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.detail === "string") {
        detail = errorBody.detail;
      }
    } catch {
      // Fall back to the HTTP status when the body is not JSON.
    }
    throw new Error(detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n\n")) {
      const boundary = buffer.indexOf("\n\n");
      const chunk = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);

      if (!chunk) {
        continue;
      }

      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) {
          continue;
        }

        const payloadText = line.slice(6).trim();
        if (!payloadText) {
          continue;
        }

        try {
          yield JSON.parse(payloadText);
        } catch {
          yield { type: "raw", content: payloadText };
        }
      }
    }
  }
}

export async function getUsageSummary(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/usage/summary", { token });
}

export async function getSynthesisRolloutStatus(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/evals/synthesis-rollout", { token });
}

export async function getSynthesisRolloutPlan(baseUrl, token, environment = "local") {
  const query = new URLSearchParams({ environment }).toString();
  return requestJson(baseUrl, `/api/v1/deploy/synthesis-rollout-plan?${query}`, { token });
}

export async function getSynthesisRolloutValidation(baseUrl, token, environment = "local") {
  const query = new URLSearchParams({ environment }).toString();
  return requestJson(baseUrl, `/api/v1/deploy/synthesis-rollout-validate?${query}`, { token });
}

export async function getRoutingBenchmark(baseUrl, token, suite = "policy") {
  const query = new URLSearchParams({ suite }).toString();
  return requestJson(baseUrl, `/api/v1/evals/routing-benchmark?${query}`, { token });
}

export async function getQualityBenchmark(baseUrl, token, suite = "swe-fixtures") {
  const query = new URLSearchParams({ suite }).toString();
  return requestJson(baseUrl, `/api/v1/evals/quality-benchmark?${query}`, { token });
}

export async function getQualityBenchmarkTrends(baseUrl, token, suite = "swe-fixtures", limit = 20) {
  const query = new URLSearchParams({ suite, limit: String(limit) }).toString();
  return requestJson(baseUrl, `/api/v1/evals/quality-benchmark/trends?${query}`, { token });
}

export async function getRoutingBenchmarkTrends(baseUrl, token, suite = "policy", limit = 20) {
  const query = new URLSearchParams({ suite, limit: String(limit) }).toString();
  return requestJson(baseUrl, `/api/v1/evals/routing-benchmark/trends?${query}`, { token });
}

export async function getCoworkReliability(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/cowork/reliability", { token });
}

export async function getCoworkReliabilityHistory(baseUrl, token, limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) }).toString();
  return requestJson(baseUrl, `/api/v1/cowork/reliability/history?${query}`, { token });
}

export async function createCoworkPlan(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/cowork/plans", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listCoworkPlans(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/cowork/plans", { token });
}

export async function runCoworkPlan(baseUrl, token, planId, approved = false) {
  return requestJson(baseUrl, `/api/v1/cowork/plans/${planId}/run`, {
    method: "POST",
    token,
    body: { approved },
  });
}

export async function listCoworkRuns(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/cowork/runs", { token });
}

export async function createCoworkJob(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/cowork/jobs", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listCoworkJobs(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/cowork/jobs", { token });
}

export async function toggleCoworkJob(baseUrl, token, jobId, enabled) {
  return requestJson(baseUrl, `/api/v1/cowork/jobs/${jobId}/toggle`, {
    method: "POST",
    token,
    body: { enabled },
  });
}

export async function extractCoworkData(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/cowork/extract", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listCoworkExtractions(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/cowork/extract", { token });
}

export async function exportSession(baseUrl, token, sessionId, format = "json") {
  const query = new URLSearchParams({ format }).toString();
  return requestJson(baseUrl, `/api/v1/team/session-export/${sessionId}?${query}`, { token });
}

export async function createSessionShare(baseUrl, token, sessionId, accessLevel = "view", expiresInHours = 72) {
  return requestJson(baseUrl, "/api/v1/team/session-share", {
    method: "POST",
    token,
    body: {
      session_id: sessionId,
      access_level: accessLevel,
      expires_in_hours: expiresInHours,
    },
  });
}

export async function resolveSessionShare(baseUrl, token, shareId) {
  return requestJson(baseUrl, `/api/v1/team/session-share/${shareId}`, { token });
}

export async function rebuildProjectKnowledge(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/projects/knowledge/rebuild", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function uploadProjectKnowledge(baseUrl, token, sessionId, files) {
  const form = new FormData();
  form.append("session_id", sessionId);
  for (const file of files) {
    form.append("files", file);
  }

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/projects/knowledge/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.detail === "string") {
        detail = errorBody.detail;
      }
    } catch {
      // Fall back to the HTTP status when the body is not JSON.
    }
    throw new Error(detail);
  }

  return response.json();
}

export async function getProjectKnowledge(baseUrl, token, sessionId) {
  const query = new URLSearchParams({ session_id: sessionId }).toString();
  return requestJson(baseUrl, `/api/v1/projects/knowledge?${query}`, { token });
}

export async function queryProjectKnowledge(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/projects/knowledge/query", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function createTeamWorkspace(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/team/workspaces", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listTeamWorkspaces(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/team/workspaces", { token });
}

export async function addTeamWorkspaceMember(baseUrl, token, workspaceId, payload) {
  return requestJson(baseUrl, `/api/v1/team/workspaces/${workspaceId}/members`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function createTeamDelegation(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/team/delegations", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listTeamDelegations(baseUrl, token, workspaceId = null) {
  const query = workspaceId ? `?${new URLSearchParams({ workspace_id: workspaceId }).toString()}` : "";
  return requestJson(baseUrl, `/api/v1/team/delegations${query}`, { token });
}

export async function listTeamAuditLog(baseUrl, token, workspaceId = null, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (workspaceId) {
    params.set("workspace_id", workspaceId);
  }
  return requestJson(baseUrl, `/api/v1/team/audit-log?${params.toString()}`, { token });
}

export async function executeTeamDelegation(baseUrl, token, taskId) {
  return requestJson(baseUrl, `/api/v1/team/delegations/${taskId}/execute`, {
    method: "POST",
    token,
  });
}

export async function exchangeOidcToken(baseUrl, payload) {
  return requestJson(baseUrl, "/api/v1/auth/oidc/exchange", {
    method: "POST",
    body: payload,
  });
}

export async function getOidcConfig(baseUrl) {
  return requestJson(baseUrl, "/api/v1/auth/oidc/config");
}

export async function getOidcAuthorizeUrl(baseUrl, redirectUri = null, state = null) {
  const params = new URLSearchParams();
  if (redirectUri) {
    params.set("redirect_uri", redirectUri);
  }
  if (state) {
    params.set("state", state);
  }
  const query = params.toString();
  return requestJson(baseUrl, `/api/v1/auth/oidc/authorize-url${query ? `?${query}` : ""}`);
}

export async function completeOidcCallback(baseUrl, payload) {
  return requestJson(baseUrl, "/api/v1/auth/oidc/callback", {
    method: "POST",
    body: payload,
  });
}

export async function getOidcDiscovery(baseUrl) {
  return requestJson(baseUrl, "/api/v1/auth/oidc/discovery");
}

export async function approveTeamDelegationStep(baseUrl, token, taskId, payload) {
  return requestJson(baseUrl, `/api/v1/team/delegations/${taskId}/approve-step`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function createTeamStyleGuide(baseUrl, token, workspaceId, payload) {
  return requestJson(baseUrl, `/api/v1/team/workspaces/${workspaceId}/style-guides`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listTeamStyleGuides(baseUrl, token, workspaceId) {
  return requestJson(baseUrl, `/api/v1/team/workspaces/${workspaceId}/style-guides`, { token });
}

export async function updateTeamStyleGuide(baseUrl, token, workspaceId, guideId, payload) {
  return requestJson(baseUrl, `/api/v1/team/workspaces/${workspaceId}/style-guides/${guideId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function createRemoteChannel(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/remote/channels", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listRemoteChannels(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/remote/channels", { token });
}

export async function pairRemoteChannel(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/remote/channels/pair", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function pushRemoteChannelEvent(baseUrl, token, channelId, payload) {
  return requestJson(baseUrl, `/api/v1/remote/channels/${channelId}/push`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listSessionArtifacts(baseUrl, token, sessionId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/artifacts`, { token });
}

export async function getSessionArtifact(baseUrl, token, sessionId, artifactId) {
  return requestJson(baseUrl, `/api/v1/sessions/${sessionId}/artifacts/${artifactId}`, { token });
}

export function sessionArtifactPreviewUrl(baseUrl, sessionId, artifactId) {
  return `${normalizeBaseUrl(baseUrl)}/api/v1/sessions/${sessionId}/artifacts/${artifactId}/preview`;
}

export async function createAgentTemplate(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/agent/templates", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listAgentTemplates(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/agent/templates", { token });
}

export async function deleteAgentTemplate(baseUrl, token, templateId) {
  return requestJson(baseUrl, `/api/v1/agent/templates/${templateId}`, {
    method: "DELETE",
    token,
  });
}

export async function composeAgentTemplate(baseUrl, token, templateId, userTask) {
  return requestJson(baseUrl, `/api/v1/agent/templates/${templateId}/compose`, {
    method: "POST",
    token,
    body: { user_task: userTask },
  });
}

export async function createContextPack(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/context/packs", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listContextPacks(baseUrl, token, sessionId) {
  const query = sessionId ? `?${new URLSearchParams({ session_id: sessionId }).toString()}` : "";
  return requestJson(baseUrl, `/api/v1/context/packs${query}`, { token });
}

export async function attachContextPack(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/context/attach", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getSessionContext(baseUrl, token, sessionId) {
  return requestJson(baseUrl, `/api/v1/context/session/${sessionId}`, { token });
}

export async function createMcpConnector(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/mcp/connectors", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listMcpConnectors(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/mcp/connectors", { token });
}

export async function toggleMcpConnector(baseUrl, token, connectorId, enabled) {
  return requestJson(baseUrl, `/api/v1/mcp/connectors/${connectorId}/toggle`, {
    method: "POST",
    token,
    body: { enabled },
  });
}

export async function invokeMcpConnector(baseUrl, token, connectorId, payload) {
  return requestJson(baseUrl, `/api/v1/mcp/connectors/${connectorId}/invoke`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listBillingPlans(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/billing/plans", { token });
}

export async function createBillingOrder(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/billing/create-order", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function verifyBillingPayment(baseUrl, token, payload) {
  return requestJson(baseUrl, "/api/v1/billing/verify-payment", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getBillingSubscription(baseUrl, token) {
  return requestJson(baseUrl, "/api/v1/billing/subscription", { token });
}

async function* streamSseJson(baseUrl, path, token) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Streaming failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n\n")) {
      const boundary = buffer.indexOf("\n\n");
      const chunk = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);

      if (!chunk) {
        continue;
      }

      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) {
          continue;
        }

        const payload = line.slice(6).trim();
        if (!payload) {
          continue;
        }

        try {
          yield JSON.parse(payload);
        } catch {
          yield { type: "raw", content: payload };
        }
      }
    }
  }
}

export async function* streamTeamEvents(baseUrl, token) {
  yield* streamSseJson(baseUrl, "/api/v1/team/events", token);
}

export async function* streamRemoteChannelEvents(baseUrl, token, channelId) {
  yield* streamSseJson(baseUrl, `/api/v1/remote/channels/${channelId}/events`, token);
}

export async function* streamSessionEvents(baseUrl, token, sessionId) {
  yield* streamSseJson(baseUrl, `/api/v1/sessions/${sessionId}/stream`, token);
}

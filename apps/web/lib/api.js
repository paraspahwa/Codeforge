import * as shared from "@codeforge/shared/api";
import { createSessionStream } from "@codeforge/shared/agent";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const USE_API_PROXY = process.env.NEXT_PUBLIC_API_DIRECT === "false";

export async function fetchWithRetry(url, options = {}, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

function resolveApiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (USE_API_PROXY) {
    return `/api/proxy${normalized}`;
  }
  return `${API_BASE}${normalized}`;
}

export async function getStackStatus() {
  const response = await fetchWithRetry(resolveApiUrl("/api/v1/platform/stack-status"));
  if (!response.ok) {
    throw new Error("Failed to load stack status");
  }
  return response.json();
}

export async function devLogin(userId) {
  const response = await fetch("/api/auth/dev-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.detail) {
        detail = typeof errorBody.detail === "string" ? errorBody.detail : detail;
      }
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const data = await response.json();
  return data.access_token;
}

export async function getAuthConfig() {
  const response = await fetchWithRetry(resolveApiUrl("/api/v1/auth/config"));
  if (!response.ok) {
    throw new Error("Failed to load auth configuration");
  }
  return response.json();
}

export async function registerAccount({ email, username, password }) {
  const response = await fetch(resolveApiUrl("/api/v1/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });
  if (!response.ok) {
    let detail = "Registration failed";
    try {
      const errorBody = await response.json();
      if (errorBody?.detail) {
        detail = typeof errorBody.detail === "string" ? errorBody.detail : detail;
      }
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const data = await response.json();
  return data.access_token;
}

export async function loginWithCredentials({ email, password }) {
  const response = await fetch(resolveApiUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    let detail = "Invalid credentials";
    try {
      const errorBody = await response.json();
      if (errorBody?.detail) {
        detail = typeof errorBody.detail === "string" ? errorBody.detail : detail;
      }
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const data = await response.json();
  return data.access_token;
}

export async function getAccountProfile(token) {
  const response = await fetch(resolveApiUrl("/api/v1/auth/me"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Failed to load account profile");
  }
  return response.json();
}

export async function changeAccountPassword(token, { currentPassword, newPassword }) {
  const response = await fetch(resolveApiUrl("/api/v1/auth/change-password"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!response.ok) {
    let detail = "Password change failed";
    try {
      const errorBody = await response.json();
      if (errorBody?.detail) {
        detail = typeof errorBody.detail === "string" ? errorBody.detail : detail;
      }
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return response.json();
}

export async function getOidcConfig() {
  return shared.getOidcConfig(API_BASE);
}

export async function getOidcAuthorizeUrl(redirectUri = null, state = null) {
  return shared.getOidcAuthorizeUrl(API_BASE, redirectUri, state);
}

export async function completeOidcCallback(payload) {
  const data = await shared.completeOidcCallback(API_BASE, payload);
  return data.access_token;
}

export async function createSession(projectPath, token) {
  return shared.createSession(API_BASE, token, {
    project_path: projectPath,
    model_preference: "auto",
  });
}

export async function listSessions(token) {
  return shared.listSessions(API_BASE, token);
}

export async function listAgents(category) {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const response = await fetch(`${API_BASE}/api/v1/agents${query}`);
  if (!response.ok) {
    throw new Error("Failed to load agents");
  }
  return response.json();
}

export async function getUsageSummary(token) {
  return shared.getUsageSummary(API_BASE, token);
}

export async function getRoutingBenchmark(token, suite = "policy") {
  return shared.getRoutingBenchmark(API_BASE, token, suite);
}

export async function getRoutingBenchmarkTrends(token, suite = "policy", limit = 20) {
  return shared.getRoutingBenchmarkTrends(API_BASE, token, suite, limit);
}

export async function getCoworkReliability(token) {
  return shared.getCoworkReliability(API_BASE, token);
}

export async function getCoworkReliabilityHistory(token, limit = 50) {
  return shared.getCoworkReliabilityHistory(API_BASE, token, limit);
}

export async function createCoworkPlan(token, payload) {
  return shared.createCoworkPlan(API_BASE, token, payload);
}

export async function listCoworkPlans(token) {
  return shared.listCoworkPlans(API_BASE, token);
}

export async function runCoworkPlan(token, planId, approved = false) {
  return shared.runCoworkPlan(API_BASE, token, planId, approved);
}

export async function listCoworkRuns(token) {
  return shared.listCoworkRuns(API_BASE, token);
}

export async function createCoworkJob(token, payload) {
  return shared.createCoworkJob(API_BASE, token, payload);
}

export async function listCoworkJobs(token) {
  return shared.listCoworkJobs(API_BASE, token);
}

export async function toggleCoworkJob(token, jobId, enabled) {
  return shared.toggleCoworkJob(API_BASE, token, jobId, enabled);
}

export async function extractCoworkData(token, payload) {
  return shared.extractCoworkData(API_BASE, token, payload);
}

export async function scrapeCoworkData(token, payload) {
  return shared.scrapeCoworkData(API_BASE, token, payload);
}

export async function previewCoworkGoal(token, payload) {
  return shared.previewCoworkGoal(API_BASE, token, payload);
}

export async function runCoworkGoal(token, payload) {
  return shared.runCoworkGoal(API_BASE, token, payload);
}

export async function synthesizeCoworkDocument(token, payload) {
  return shared.synthesizeCoworkDocument(API_BASE, token, payload);
}

export async function listCoworkExtractions(token) {
  return shared.listCoworkExtractions(API_BASE, token);
}

export async function getSynthesisRolloutPlan(token, environment = "local") {
  return shared.getSynthesisRolloutPlan(API_BASE, token, environment);
}

export async function getSynthesisRolloutValidation(token, environment = "local") {
  return shared.getSynthesisRolloutValidation(API_BASE, token, environment);
}

export async function getGitConflictGuide(token, sessionId, targetBranch) {
  return shared.getGitConflictGuide(API_BASE, token, sessionId, targetBranch);
}

export async function applyGitConflictAssist(token, sessionId, payload) {
  return shared.applyGitConflictAssist(API_BASE, token, sessionId, payload);
}

export async function createContextPack(token, payload) {
  return shared.createContextPack(API_BASE, token, payload);
}

export async function listContextPacks(token, sessionId = null) {
  return shared.listContextPacks(API_BASE, token, sessionId);
}

export async function createMcpConnector(token, payload) {
  return shared.createMcpConnector(API_BASE, token, payload);
}

export async function listMcpConnectors(token) {
  return shared.listMcpConnectors(API_BASE, token);
}

export async function toggleMcpConnector(token, connectorId, enabled) {
  return shared.toggleMcpConnector(API_BASE, token, connectorId, enabled);
}

export async function listMcpCatalog(token, category) {
  return shared.listMcpCatalog(API_BASE, token, category);
}

export async function installMcpCatalogServer(token, serverId) {
  return shared.installMcpCatalogServer(API_BASE, token, serverId);
}

export async function installMcpCatalogCategory(token, categoryId) {
  return shared.installMcpCatalogCategory(API_BASE, token, categoryId);
}

export async function installAllMcpCatalog(token) {
  return shared.installAllMcpCatalog(API_BASE, token);
}

export async function listExtensionsCatalog(token, category) {
  return shared.listExtensionsCatalog(API_BASE, token, category);
}

export async function installExtension(token, extensionId, projectPath) {
  return shared.installExtension(API_BASE, token, extensionId, projectPath);
}

export async function installAllLspExtensions(token) {
  return shared.installAllLspExtensions(API_BASE, token);
}

export async function disableExtension(token, extensionId) {
  return shared.disableExtension(API_BASE, token, extensionId);
}

export async function updateExtension(token, extensionId, projectPath) {
  return shared.updateExtension(API_BASE, token, extensionId, projectPath);
}

export async function disableMcpCatalogServer(token, serverId) {
  return shared.disableMcpCatalogServer(API_BASE, token, serverId);
}

export async function updateMcpCatalogServer(token, serverId) {
  return shared.updateMcpCatalogServer(API_BASE, token, serverId);
}

export async function listBillingPlans() {
  return shared.listBillingPlans(API_BASE);
}

export async function createBillingOrder(token, payload) {
  return shared.createBillingOrder(API_BASE, token, {
    currency: "INR",
    ...payload,
  });
}

export async function verifyBillingPayment(token, payload) {
  return shared.verifyBillingPayment(API_BASE, token, payload);
}

export async function getBillingSubscription(token) {
  return shared.getBillingSubscription(API_BASE, token);
}

export async function getBillingContext(token) {
  return shared.getBillingContext(API_BASE, token);
}

export async function exportSession(sessionId, token, format = "json") {
  return shared.exportSession(API_BASE, token, sessionId, format);
}

export async function createSessionShare(token, sessionId, accessLevel = "view", expiresInHours = 72) {
  return shared.createSessionShare(API_BASE, token, sessionId, accessLevel, expiresInHours);
}

export async function resolveSessionShare(token, shareId) {
  return shared.resolveSessionShare(API_BASE, token, shareId);
}

export async function rebuildProjectKnowledge(token, payload) {
  return shared.rebuildProjectKnowledge(API_BASE, token, payload);
}

export async function uploadProjectKnowledge(token, sessionId, files) {
  return shared.uploadProjectKnowledge(API_BASE, token, sessionId, files);
}

export async function getProjectKnowledge(token, sessionId) {
  return shared.getProjectKnowledge(API_BASE, token, sessionId);
}

export async function queryProjectKnowledge(token, payload) {
  return shared.queryProjectKnowledge(API_BASE, token, payload);
}

export async function createTeamWorkspace(token, payload) {
  return shared.createTeamWorkspace(API_BASE, token, payload);
}

export async function listTeamWorkspaces(token) {
  return shared.listTeamWorkspaces(API_BASE, token);
}

export async function addTeamWorkspaceMember(token, workspaceId, payload) {
  return shared.addTeamWorkspaceMember(API_BASE, token, workspaceId, payload);
}

export async function createTeamDelegation(token, payload) {
  return shared.createTeamDelegation(API_BASE, token, payload);
}

export async function listTeamDelegations(token, workspaceId = null) {
  return shared.listTeamDelegations(API_BASE, token, workspaceId);
}

export async function listTeamAuditLog(token, workspaceId = null, limit = 50) {
  return shared.listTeamAuditLog(API_BASE, token, workspaceId, limit);
}

export async function executeTeamDelegation(token, taskId) {
  return shared.executeTeamDelegation(API_BASE, token, taskId);
}

export async function approveTeamDelegationStep(token, taskId, payload) {
  return shared.approveTeamDelegationStep(API_BASE, token, taskId, payload);
}

export function streamTeamEvents(token) {
  return shared.streamTeamEvents(API_BASE, token);
}

export async function listTeamStyleGuides(token, workspaceId) {
  return shared.listTeamStyleGuides(API_BASE, token, workspaceId);
}

export async function createTeamStyleGuide(token, workspaceId, payload) {
  return shared.createTeamStyleGuide(API_BASE, token, workspaceId, payload);
}

export async function updateTeamStyleGuide(token, workspaceId, guideId, payload) {
  return shared.updateTeamStyleGuide(API_BASE, token, workspaceId, guideId, payload);
}

export async function createOrganization(token, payload) {
  return shared.createOrganization(API_BASE, token, payload);
}

export async function listOrganizations(token) {
  return shared.listOrganizations(API_BASE, token);
}

export async function addOrganizationMember(token, orgId, payload) {
  return shared.addOrganizationMember(API_BASE, token, orgId, payload);
}

export async function linkWorkspaceOrg(token, workspaceId, orgId) {
  return shared.linkWorkspaceOrg(API_BASE, token, workspaceId, orgId);
}

export async function upgradeOrganizationPlan(token, orgId, planId) {
  return shared.upgradeOrganizationPlan(API_BASE, token, orgId, planId);
}

export async function createWorkspaceSessionGrant(token, workspaceId, payload) {
  return shared.createWorkspaceSessionGrant(API_BASE, token, workspaceId, payload);
}

export async function listWorkspaceSessionGrants(token, workspaceId) {
  return shared.listWorkspaceSessionGrants(API_BASE, token, workspaceId);
}

export async function getDeployReadiness(probeDiscovery = false) {
  const params = probeDiscovery ? "?probe_discovery=true" : "";
  const base = API_BASE.replace(/\/+$/, "");
  const response = await fetch(`${base}/api/v1/platform/deploy-readiness${params}`);
  if (!response.ok) {
    throw new Error(`Deploy readiness failed with status ${response.status}`);
  }
  return response.json();
}

export async function getQualitySummary(suite = "swe-fixtures") {
  const base = API_BASE.replace(/\/+$/, "");
  const response = await fetch(`${base}/api/v1/platform/quality-summary?suite=${encodeURIComponent(suite)}`);
  if (!response.ok) {
    throw new Error(`Quality summary failed with status ${response.status}`);
  }
  return response.json();
}

export async function getAgentReachStatus() {
  const base = API_BASE.replace(/\/+$/, "");
  const response = await fetch(`${base}/api/v1/platform/agent-reach/status`);
  if (!response.ok) {
    throw new Error(`Agent Reach status failed with status ${response.status}`);
  }
  return response.json();
}

export async function getTasteRules(token) {
  return shared.getTasteRules(API_BASE, token);
}

export async function getTasteStats(token) {
  return shared.getTasteStats(API_BASE, token);
}

export async function exportTaste(token) {
  return shared.exportTaste(API_BASE, token);
}

export async function importTaste(token, payload) {
  return shared.importTaste(API_BASE, token, payload);
}

export async function listSkills(token, projectPath = null) {
  return shared.listSkills(API_BASE, token, projectPath);
}

export async function getAgentPreferences(token) {
  return shared.getAgentPreferences(API_BASE, token);
}

export async function updateAgentPreferences(token, payload) {
  return shared.updateAgentPreferences(API_BASE, token, payload);
}

export async function getRtkStatus(token) {
  return shared.getRtkStatus(API_BASE, token);
}

export async function getHermesStatus(token) {
  return shared.getHermesStatus(API_BASE, token);
}

export async function listMemories(token, projectPath = null) {
  return shared.listMemories(API_BASE, token, projectPath);
}

export async function searchMemory(token, query, projectPath = null) {
  return shared.searchMemory(API_BASE, token, query, projectPath);
}

export async function saveMemory(token, payload) {
  return shared.saveMemory(API_BASE, token, payload);
}

export async function exportMemory(token) {
  return shared.exportMemory(API_BASE, token);
}

export async function getSupermemoryStatus(token, projectPath = null) {
  return shared.getSupermemoryStatus(API_BASE, token, projectPath);
}

export async function searchSupermemory(token, query, projectPath = null, scope = "both") {
  return shared.searchSupermemory(API_BASE, token, query, projectPath, scope);
}

export async function saveSupermemory(token, payload) {
  return shared.saveSupermemory(API_BASE, token, payload);
}

export async function sendMessage(sessionId, content, token, context = null, templateId = null) {
  const body = { content, context };
  if (templateId) {
    body.template_id = templateId;
  }
  return shared.sendMessage(API_BASE, token, sessionId, body);
}

export async function listSessionArtifacts(sessionId, token) {
  return shared.listSessionArtifacts(API_BASE, token, sessionId);
}

export async function getSessionArtifact(sessionId, artifactId, token) {
  return shared.getSessionArtifact(API_BASE, token, sessionId, artifactId);
}

export async function fetchSessionArtifactPreviewHtml(sessionId, artifactId, token) {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const response = await fetch(
    `${base.replace(/\/+$/, "")}/api/v1/sessions/${sessionId}/artifacts/${artifactId}/preview`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Preview failed with status ${response.status}`);
  }
  return response.text();
}

export async function listAgentTemplates(token) {
  return shared.listAgentTemplates(API_BASE, token);
}

export async function createAgentTemplate(token, payload) {
  return shared.createAgentTemplate(API_BASE, token, payload);
}

export async function getProposal(sessionId, proposalId, token) {
  return shared.getProposal(API_BASE, token, sessionId, proposalId);
}

export async function listProposals(sessionId, token, limit = 50) {
  return shared.listProposals(API_BASE, token, sessionId, limit);
}

export async function decideProposal(sessionId, proposalId, action, token) {
  return shared.decideProposal(API_BASE, token, sessionId, proposalId, action);
}

export async function listMessages(sessionId, token) {
  return shared.listMessages(API_BASE, token, sessionId);
}

export function streamSession(sessionId, token, onData) {
  return createSessionStream(API_BASE, token, sessionId, onData);
}

export async function forkSession(sessionId, token, payload = {}) {
  return shared.forkSession(API_BASE, token, sessionId, payload);
}

export async function runAgentLoop(sessionId, token, payload) {
  return shared.runAgentLoop(API_BASE, token, sessionId, payload);
}

export async function resolveLoopVerify(sessionId, token, payload = {}) {
  return shared.resolveLoopVerify(API_BASE, token, sessionId, payload);
}

export async function compactWorkflow(sessionId, token) {
  return shared.compactWorkflow(API_BASE, token, sessionId);
}

export async function ultrareviewWorkflow(sessionId, token, payload = {}) {
  return shared.ultrareviewWorkflow(API_BASE, token, sessionId, payload);
}

export async function createWorkflowPlan(sessionId, token, targets) {
  return shared.createWorkflowPlan(API_BASE, token, sessionId, targets);
}

export async function executeWorkflowPlan(sessionId, token, planId, payload = {}) {
  return shared.executeWorkflowPlan(API_BASE, token, sessionId, planId, payload);
}

export async function rollbackWorkflowPlan(sessionId, token, planId) {
  return shared.rollbackWorkflowPlan(API_BASE, token, sessionId, planId);
}

export async function getGitStatus(token, sessionId) {
  return shared.getGitStatus(API_BASE, token, sessionId);
}

export async function getGitDiff(token, sessionId, path) {
  return shared.getGitDiff(API_BASE, token, sessionId, path);
}

export async function getFilePreview(token, sessionId, path) {
  return shared.getFilePreview(API_BASE, token, sessionId, path);
}

export async function getFileContent(token, sessionId, path) {
  return shared.getFileContent(API_BASE, token, sessionId, path);
}

export async function requestCodeCompletion(token, sessionId, payload) {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/code/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Completion failed (${response.status})`);
  }
  return response.json();
}

export async function applyFile(token, sessionId, payload) {
  return shared.applyFile(API_BASE, token, sessionId, payload);
}

export async function createWorkspaceFile(token, sessionId, payload) {
  return shared.createWorkspaceFile(API_BASE, token, sessionId, payload);
}

export async function deleteWorkspaceFile(token, sessionId, path) {
  return shared.deleteWorkspaceFile(API_BASE, token, sessionId, path);
}

export async function renameWorkspaceFile(token, sessionId, fromPath, toPath) {
  return shared.renameWorkspaceFile(API_BASE, token, sessionId, fromPath, toPath);
}

export async function uploadSessionAttachments(token, sessionId, files) {
  return shared.uploadSessionAttachments(API_BASE, token, sessionId, files);
}

export async function listSessionAttachments(token, sessionId) {
  return shared.listSessionAttachments(API_BASE, token, sessionId);
}

export function streamShellCommand(token, sessionId, payload) {
  return shared.streamShellCommand(API_BASE, token, sessionId, payload);
}

export async function getGitLog(token, sessionId, limit = 10) {
  return shared.getGitLog(API_BASE, token, sessionId, limit);
}

export async function stageGitFiles(token, sessionId, payload) {
  return shared.stageGitFiles(API_BASE, token, sessionId, payload);
}

export async function commitGitChanges(token, sessionId, message) {
  return shared.commitGitChanges(API_BASE, token, sessionId, message);
}

export async function branchGitRepo(token, sessionId, payload) {
  return shared.branchGitRepo(API_BASE, token, sessionId, payload);
}

export async function getGitMergeAssist(token, sessionId, targetBranch) {
  return shared.getGitMergeAssist(API_BASE, token, sessionId, targetBranch);
}

export async function listWorkspaceFiles(token, sessionId, limit = 300) {
  return shared.listWorkspaceFiles(API_BASE, token, sessionId, limit);
}

export async function searchWeb(token, sessionId, query, limit = 5) {
  return shared.searchWeb(API_BASE, token, sessionId, query, limit);
}

export async function searchSymbols(token, sessionId, query, limit = 40) {
  return shared.searchSymbols(API_BASE, token, sessionId, query, limit);
}

export async function searchWorkspace(token, sessionId, query) {
  return shared.searchWorkspace(API_BASE, token, sessionId, query);
}

export async function gitPush(token, sessionId, payload = {}) {
  return shared.gitPush(API_BASE, token, sessionId, payload);
}

export async function gitPull(token, sessionId, payload = {}) {
  return shared.gitPull(API_BASE, token, sessionId, payload);
}

export async function gitFetch(token, sessionId, remote = "origin") {
  return shared.gitFetch(API_BASE, token, sessionId, remote);
}

export async function createPullRequest(token, sessionId, payload) {
  return shared.createPullRequest(API_BASE, token, sessionId, payload);
}

export async function listCheckpoints(token, sessionId) {
  return shared.listCheckpoints(API_BASE, token, sessionId);
}

export async function rewindCheckpoint(token, sessionId, checkpointId, payload = {}) {
  return shared.rewindCheckpoint(API_BASE, token, sessionId, checkpointId, payload);
}

export async function getContextStack(token, sessionId) {
  return shared.getContextStack(API_BASE, token, sessionId);
}

export async function lspDefinition(token, sessionId, path, line = 1, character = 0) {
  return shared.lspDefinition(API_BASE, token, sessionId, path, line, character);
}

export async function lspReferences(token, sessionId, path, line = 1, character = 0) {
  return shared.lspReferences(API_BASE, token, sessionId, path, line, character);
}

export async function getDiagnostics(token, sessionId, path) {
  return shared.getDiagnostics(API_BASE, token, sessionId, path);
}

export function ptyWebSocketUrl(sessionId, token) {
  return shared.ptyWebSocketUrl(API_BASE, sessionId, token);
}

export function streamFileWatch(token, sessionId, onEvent) {
  const controller = new AbortController();
  const handle = { close: () => controller.abort() };

  (async () => {
    const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/files/watch`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      return;
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
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) {
            continue;
          }
          try {
            const payload = JSON.parse(line.slice(6));
            onEvent?.(payload);
          } catch {
            // ignore malformed chunks
          }
        }
      }
    }
  })().catch(() => undefined);

  return handle;
}

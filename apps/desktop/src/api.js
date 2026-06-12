import * as shared from "@codeforge/shared/api";

const API_BASE = import.meta.env.VITE_CODEFORGE_API_BASE_URL || "http://localhost:8000";

export async function devLogin(userId) {
  const data = await shared.devLogin(API_BASE, userId);
  return data.access_token;
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

export async function approveTeamDelegationStep(token, taskId, payload) {
  return shared.approveTeamDelegationStep(API_BASE, token, taskId, payload);
}

export async function listSessions(token) {
  return shared.listSessions(API_BASE, token);
}

export async function createSession(token, projectPath) {
  return shared.createSession(API_BASE, token, {
    project_path: projectPath,
    model_preference: "auto",
  });
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

export async function listCoworkExtractions(token) {
  return shared.listCoworkExtractions(API_BASE, token);
}

export async function getGitConflictGuide(token, sessionId, targetBranch) {
  return shared.getGitConflictGuide(API_BASE, token, sessionId, targetBranch);
}

export async function applyGitConflictAssist(token, sessionId, payload) {
  return shared.applyGitConflictAssist(API_BASE, token, sessionId, payload);
}

export async function getSynthesisRolloutPlan(token, environment = "local") {
  return shared.getSynthesisRolloutPlan(API_BASE, token, environment);
}

export async function getSynthesisRolloutValidation(token, environment = "local") {
  return shared.getSynthesisRolloutValidation(API_BASE, token, environment);
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

export async function listMessages(token, sessionId) {
  return shared.listMessages(API_BASE, token, sessionId);
}

export async function sendMessage(token, sessionId, content, projectPath, activeFile = null, templateId = null) {
  const body = {
    content,
    context: {
      workspace_path: projectPath,
      selection: null,
      active_file: activeFile,
    },
  };
  if (templateId) {
    body.template_id = templateId;
  }
  return shared.sendMessage(API_BASE, token, sessionId, body);
}

export async function listSessionArtifacts(token, sessionId) {
  return shared.listSessionArtifacts(API_BASE, token, sessionId);
}

export async function fetchSessionArtifactPreviewHtml(token, sessionId, artifactId) {
  const response = await fetch(
    `${API_BASE.replace(/\/+$/, "")}/api/v1/sessions/${sessionId}/artifacts/${artifactId}/preview`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Artifact preview failed (${response.status})`);
  }
  return response.text();
}

export async function listAgentTemplates(token) {
  return shared.listAgentTemplates(API_BASE, token);
}

export async function createAgentTemplate(token, payload) {
  return shared.createAgentTemplate(API_BASE, token, payload);
}

export async function listProposals(token, sessionId, limit = 50) {
  return shared.listProposals(API_BASE, token, sessionId, limit);
}

export async function getProposal(token, sessionId, proposalId) {
  return shared.getProposal(API_BASE, token, sessionId, proposalId);
}

export async function decideProposal(token, sessionId, proposalId, action) {
  return shared.decideProposal(API_BASE, token, sessionId, proposalId, action);
}

export async function getUsageSummary(token) {
  return shared.getUsageSummary(API_BASE, token);
}

export async function getGitStatus(token, sessionId) {
  return shared.getGitStatus(API_BASE, token, sessionId);
}

export async function getGitDiff(token, sessionId, path = null) {
  return shared.getGitDiff(API_BASE, token, sessionId, path);
}

export async function getFilePreview(token, sessionId, path) {
  return shared.getFilePreview(API_BASE, token, sessionId, path);
}

export async function runAgentLoop(token, sessionId, payload) {
  return shared.runAgentLoop(API_BASE, token, sessionId, payload);
}

export function streamSessionEvents(token, sessionId) {
  return shared.streamSessionEvents(API_BASE, token, sessionId);
}

export function streamShellCommand(token, sessionId, payload) {
  return shared.streamShellCommand(API_BASE, token, sessionId, payload);
}

export async function forkSession(token, sessionId) {
  return shared.forkSession(API_BASE, token, sessionId);
}

export async function compactWorkflow(token, sessionId) {
  return shared.compactWorkflow(API_BASE, token, sessionId);
}

export async function ultrareviewWorkflow(token, sessionId, payload = {}) {
  return shared.ultrareviewWorkflow(API_BASE, token, sessionId, payload);
}

export async function createWorkflowPlan(token, sessionId, targets) {
  return shared.createWorkflowPlan(API_BASE, token, sessionId, targets);
}

export async function executeWorkflowPlan(token, sessionId, planId, payload = {}) {
  return shared.executeWorkflowPlan(API_BASE, token, sessionId, planId, payload);
}

export async function rollbackWorkflowPlan(token, sessionId, planId) {
  return shared.rollbackWorkflowPlan(API_BASE, token, sessionId, planId);
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

export async function createWorkspaceSessionGrant(token, workspaceId, payload) {
  return shared.createWorkspaceSessionGrant(API_BASE, token, workspaceId, payload);
}

export async function listWorkspaceSessionGrants(token, workspaceId) {
  return shared.listWorkspaceSessionGrants(API_BASE, token, workspaceId);
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

export async function createSessionShare(token, sessionId, accessLevel = "view", expiresInHours = 72) {
  return shared.createSessionShare(API_BASE, token, sessionId, accessLevel, expiresInHours);
}

export async function exportSession(token, sessionId, format = "json") {
  return shared.exportSession(API_BASE, token, sessionId, format);
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

export async function createRemoteChannel(token, payload) {
  return shared.createRemoteChannel(API_BASE, token, payload);
}

export async function listRemoteChannels(token) {
  return shared.listRemoteChannels(API_BASE, token);
}

export async function pairRemoteChannel(token, payload) {
  return shared.pairRemoteChannel(API_BASE, token, payload);
}

export function streamRemoteChannelEvents(token, channelId) {
  return shared.streamRemoteChannelEvents(API_BASE, token, channelId);
}

export async function scrapeCoworkData(token, payload) {
  return shared.scrapeCoworkData(API_BASE, token, payload);
}

export async function listBillingPlans(token = null) {
  return shared.listBillingPlans(API_BASE, token);
}

export async function getBillingSubscription(token) {
  return shared.getBillingSubscription(API_BASE, token);
}

export async function getBillingContext(token) {
  return shared.getBillingContext(API_BASE, token);
}

export async function getTasteStats(token) {
  return shared.getTasteStats(API_BASE, token);
}

export async function getTasteRules(token) {
  return shared.getTasteRules(API_BASE, token);
}

export async function exportTaste(token) {
  return shared.exportTaste(API_BASE, token);
}

export async function importTaste(token, payload) {
  return shared.importTaste(API_BASE, token, payload);
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

export async function listSkills(token, projectPath = null) {
  return shared.listSkills(API_BASE, token, projectPath);
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

export const API_BASE_URL = API_BASE;

import * as shared from "@codeforge/shared/api";
import { createSessionStream } from "@codeforge/shared/agent";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

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

export async function createSession(projectPath, token) {
  return shared.createSession(API_BASE, token, {
    project_path: projectPath,
    model_preference: "auto",
  });
}

export async function listSessions(token) {
  return shared.listSessions(API_BASE, token);
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

export async function forkSession(sessionId, token) {
  return shared.forkSession(API_BASE, token, sessionId);
}

export async function runAgentLoop(sessionId, token, payload) {
  return shared.runAgentLoop(API_BASE, token, sessionId, payload);
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

export function streamShellCommand(token, sessionId, payload) {
  return shared.streamShellCommand(API_BASE, token, sessionId, payload);
}

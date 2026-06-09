import * as shared from "@codeforge/shared/api";

const API_BASE = import.meta.env.VITE_CODEFORGE_API_BASE_URL || "http://localhost:8000";

export async function devLogin(userId) {
  const data = await shared.devLogin(API_BASE, userId);
  return data.access_token;
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

export async function sendMessage(token, sessionId, content, projectPath, activeFile = null) {
  return shared.sendMessage(API_BASE, token, sessionId, {
    content,
    context: {
      workspace_path: projectPath,
      selection: null,
      active_file: activeFile,
    },
  });
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

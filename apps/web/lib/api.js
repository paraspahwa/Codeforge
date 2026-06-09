import * as shared from "@codeforge/shared/api";
import { createSessionStream } from "@codeforge/shared/agent";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function devLogin(userId) {
  const data = await shared.devLogin(API_BASE, userId);
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

export async function createBillingOrder(token, planId, amountInr) {
  return shared.createBillingOrder(API_BASE, token, {
    plan_id: planId,
    amount_inr: amountInr,
    currency: "INR",
  });
}

export async function verifyBillingPayment(token, payload) {
  return shared.verifyBillingPayment(API_BASE, token, payload);
}

export async function getBillingSubscription(token) {
  return shared.getBillingSubscription(API_BASE, token);
}

export async function exportSession(sessionId, token, format = "json") {
  return shared.exportSession(API_BASE, token, sessionId, format);
}

export async function createSessionShare(token, sessionId, accessLevel = "view", expiresInHours = 72) {
  return shared.createSessionShare(API_BASE, token, sessionId, accessLevel, expiresInHours);
}

export async function sendMessage(sessionId, content, token, context = null) {
  return shared.sendMessage(API_BASE, token, sessionId, { content, context });
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

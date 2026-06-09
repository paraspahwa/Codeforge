import * as shared from "@codeforge/shared/api";

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

export async function sendMessage(sessionId, content, token) {
  return shared.sendMessage(API_BASE, token, sessionId, { content, context: null });
}

export async function getProposal(sessionId, proposalId, token) {
  return shared.getProposal(API_BASE, token, sessionId, proposalId);
}

export async function decideProposal(sessionId, proposalId, action, token) {
  return shared.decideProposal(API_BASE, token, sessionId, proposalId, action);
}

export async function listMessages(sessionId, token) {
  return shared.listMessages(API_BASE, token, sessionId);
}

export function streamSession(sessionId, token, onData) {
  const controller = new AbortController();
  const handle = {
    close: () => controller.abort(),
    onerror: null,
  };

  (async () => {
    const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/stream`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      signal: controller.signal,
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

      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2);

        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) {
            continue;
          }
          const payload = line.slice(6).trim();
          if (!payload) {
            continue;
          }
          try {
            onData(JSON.parse(payload));
          } catch {
            onData({ type: "token", content: payload });
          }
        }
      }
    }
  })().catch((error) => {
    if (controller.signal.aborted) {
      return;
    }
    if (typeof handle.onerror === "function") {
      handle.onerror(error);
    }
  });

  return handle;
}

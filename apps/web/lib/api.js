const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function devLogin(userId) {
  const response = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    throw new Error("Failed to login");
  }

  const data = await response.json();
  return data.access_token;
}

export async function createSession(projectPath, token) {
  const response = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ project_path: projectPath, model_preference: "auto" }),
  });

  if (!response.ok) {
    throw new Error("Failed to create session");
  }

  return response.json();
}

export async function listSessions(token) {
  const response = await fetch(`${API_BASE}/api/v1/sessions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to list sessions");
  }

  return response.json();
}

export async function getUsageSummary(token) {
  const response = await fetch(`${API_BASE}/api/v1/usage/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load usage summary");
  }

  return response.json();
}

export async function getRoutingBenchmark(token, suite = "policy") {
  const query = new URLSearchParams({ suite }).toString();
  const response = await fetch(`${API_BASE}/api/v1/evals/routing-benchmark?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load routing benchmark");
  }

  return response.json();
}

export async function getRoutingBenchmarkTrends(token, suite = "policy", limit = 20) {
  const query = new URLSearchParams({ suite, limit: String(limit) }).toString();
  const response = await fetch(`${API_BASE}/api/v1/evals/routing-benchmark/trends?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load routing benchmark trends");
  }

  return response.json();
}

export async function getCoworkReliability(token) {
  const response = await fetch(`${API_BASE}/api/v1/cowork/reliability`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load cowork reliability snapshot");
  }

  return response.json();
}

export async function getCoworkReliabilityHistory(token, limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) }).toString();
  const response = await fetch(`${API_BASE}/api/v1/cowork/reliability/history?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load cowork reliability history");
  }

  return response.json();
}

export async function getSynthesisRolloutPlan(token, environment = "local") {
  const query = new URLSearchParams({ environment }).toString();
  const response = await fetch(`${API_BASE}/api/v1/deploy/synthesis-rollout-plan?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to load synthesis rollout plan");
  }

  return response.json();
}

export async function getSynthesisRolloutValidation(token, environment = "local") {
  const query = new URLSearchParams({ environment }).toString();
  const response = await fetch(`${API_BASE}/api/v1/deploy/synthesis-rollout-validate?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to validate synthesis rollout readiness");
  }

  return response.json();
}

export async function getGitConflictGuide(token, sessionId, targetBranch) {
  const query = new URLSearchParams({ target_branch: targetBranch }).toString();
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/git/conflict-guide?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to load conflict guide");
  }

  return response.json();
}

export async function applyGitConflictAssist(token, sessionId, payload) {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/git/conflict-assist/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to apply conflict assist strategy");
  }

  return response.json();
}

export async function createContextPack(token, payload) {
  const response = await fetch(`${API_BASE}/api/v1/context/packs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create context pack");
  }

  return response.json();
}

export async function listContextPacks(token, sessionId = null) {
  const query = sessionId ? `?${new URLSearchParams({ session_id: sessionId }).toString()}` : "";
  const response = await fetch(`${API_BASE}/api/v1/context/packs${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load context packs");
  }

  return response.json();
}

export async function getSessionContext(token, sessionId) {
  const response = await fetch(`${API_BASE}/api/v1/context/session/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load session context");
  }

  return response.json();
}

export async function createMcpConnector(token, payload) {
  const response = await fetch(`${API_BASE}/api/v1/mcp/connectors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create MCP connector");
  }

  return response.json();
}

export async function listMcpConnectors(token) {
  const response = await fetch(`${API_BASE}/api/v1/mcp/connectors`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load MCP connectors");
  }

  return response.json();
}

export async function invokeMcpConnector(token, connectorId, payload) {
  const response = await fetch(`${API_BASE}/api/v1/mcp/connectors/${connectorId}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to invoke MCP connector");
  }

  return response.json();
}

export async function listBillingPlans() {
  const response = await fetch(`${API_BASE}/api/v1/billing/plans`);
  if (!response.ok) {
    throw new Error("Failed to load plans");
  }
  return response.json();
}

export async function createBillingOrder(token, planId, amountInr) {
  const response = await fetch(`${API_BASE}/api/v1/billing/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      plan_id: planId,
      amount_inr: amountInr,
      currency: "INR",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create billing order");
  }

  return response.json();
}

export async function verifyBillingPayment(token, payload) {
  const response = await fetch(`${API_BASE}/api/v1/billing/verify-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to verify payment");
  }

  return response.json();
}

export async function getBillingSubscription(token) {
  const response = await fetch(`${API_BASE}/api/v1/billing/subscription`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load subscription");
  }

  return response.json();
}

export async function sendMessage(sessionId, content, token) {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content, context: null }),
  });

  if (!response.ok) {
    throw new Error("Failed to send message");
  }

  return response.json();
}

export async function getProposal(sessionId, proposalId, token) {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/proposals/${proposalId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load proposal");
  }

  return response.json();
}

export async function decideProposal(sessionId, proposalId, action, token) {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/proposals/${proposalId}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to resolve proposal");
  }

  return response.json();
}

export async function listMessages(sessionId, token) {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to list messages");
  }

  return response.json();
}

export function streamSession(sessionId, token, onData) {
  const streamUrl = `${API_BASE}/api/v1/sessions/${sessionId}/stream?token=${encodeURIComponent(token)}`;
  const source = new EventSource(streamUrl);

  source.onmessage = (event) => {
    try {
      onData(JSON.parse(event.data));
    } catch {
      onData({ type: "token", content: event.data });
    }
  };

  return source;
}

const API_BASE = import.meta.env.VITE_CODEFORGE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const payload = await response.json();
      detail = payload?.detail || detail;
    } catch {
      // ignore non-json errors
    }
    throw new Error(detail);
  }

  return response.json();
}

export async function devLogin(userId) {
  const data = await request("/api/v1/auth/dev-login", {
    method: "POST",
    body: { user_id: userId },
  });
  return data.access_token;
}

export async function listSessions(token) {
  return request("/api/v1/sessions", { token });
}

export async function createSession(token, projectPath) {
  return request("/api/v1/sessions", {
    method: "POST",
    token,
    body: { project_path: projectPath, model_preference: "auto" },
  });
}

export async function createCoworkPlan(token, payload) {
  return request("/api/v1/cowork/plans", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listCoworkPlans(token) {
  return request("/api/v1/cowork/plans", { token });
}

export async function runCoworkPlan(token, planId, approved = false) {
  return request(`/api/v1/cowork/plans/${planId}/run`, {
    method: "POST",
    token,
    body: { approved },
  });
}

export async function listCoworkRuns(token) {
  return request("/api/v1/cowork/runs", { token });
}

export async function createCoworkJob(token, payload) {
  return request("/api/v1/cowork/jobs", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listCoworkJobs(token) {
  return request("/api/v1/cowork/jobs", { token });
}

export async function toggleCoworkJob(token, jobId, enabled) {
  return request(`/api/v1/cowork/jobs/${jobId}/toggle`, {
    method: "POST",
    token,
    body: { enabled },
  });
}

export async function extractCoworkData(token, payload) {
  return request("/api/v1/cowork/extract", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function listCoworkExtractions(token) {
  return request("/api/v1/cowork/extract", { token });
}

export async function getGitConflictGuide(token, sessionId, targetBranch) {
  const query = new URLSearchParams({ target_branch: targetBranch }).toString();
  return request(`/api/v1/sessions/${sessionId}/git/conflict-guide?${query}`, { token });
}

export async function applyGitConflictAssist(token, sessionId, payload) {
  return request(`/api/v1/sessions/${sessionId}/git/conflict-assist/apply`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getSynthesisRolloutPlan(token, environment = "local") {
  const query = new URLSearchParams({ environment }).toString();
  return request(`/api/v1/deploy/synthesis-rollout-plan?${query}`, { token });
}

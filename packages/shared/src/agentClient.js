import {
  compactWorkflow,
  createWorkflowPlan,
  executeWorkflowPlan,
  rollbackWorkflowPlan,
  sendMessage,
  streamSessionEvents,
  ultrareviewWorkflow,
} from "./api.js";

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export function buildMessageContext({ workspacePath = null, activeFile = null, selection = null } = {}) {
  if (!workspacePath && !activeFile && !selection) {
    return null;
  }

  return {
    workspace_path: workspacePath || null,
    active_file: activeFile || null,
    selection: selection || null,
  };
}

export async function* runChatTurn(baseUrl, token, sessionId, { content, context = null }) {
  const route = await sendMessage(baseUrl, token, sessionId, { content, context });
  yield { type: "route", payload: route };

  for await (const event of streamSessionEvents(baseUrl, token, sessionId)) {
    yield event;
    if (event.type === "complete") {
      break;
    }
  }
}

export function createSessionStream(baseUrl, token, sessionId, onEvent) {
  const controller = new AbortController();
  const handle = {
    close: () => controller.abort(),
    onerror: null,
  };

  (async () => {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/sessions/${sessionId}/stream`, {
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
            onEvent(JSON.parse(payload));
          } catch {
            onEvent({ type: "token", content: payload });
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

export async function runCompact(baseUrl, token, sessionId) {
  return compactWorkflow(baseUrl, token, sessionId);
}

export async function runUltrareview(baseUrl, token, sessionId, payload = {}) {
  return ultrareviewWorkflow(baseUrl, token, sessionId, payload);
}

export async function runMultiFilePlan(baseUrl, token, sessionId, { targets, prompt, autoMode = false }) {
  const plan = await createWorkflowPlan(baseUrl, token, sessionId, targets);
  const result = await executeWorkflowPlan(baseUrl, token, sessionId, plan.plan_id, {
    prompt,
    auto_mode: autoMode,
  });
  return { plan, result };
}

export async function rollbackPlan(baseUrl, token, sessionId, planId) {
  return rollbackWorkflowPlan(baseUrl, token, sessionId, planId);
}

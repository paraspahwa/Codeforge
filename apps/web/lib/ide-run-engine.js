/**
 * Client-side run/preview for the local IDE (no backend).
 */

export function runJavaScript(code, hooks = {}) {
  const logs = [];
  const errors = [];
  const sandboxConsole = {
    log: (...args) => {
      const line = args.map(formatArg).join(" ");
      logs.push(line);
      hooks.onLog?.(line);
    },
    warn: (...args) => {
      const line = `[warn] ${args.map(formatArg).join(" ")}`;
      logs.push(line);
      hooks.onLog?.(line);
    },
    error: (...args) => {
      const line = `[error] ${args.map(formatArg).join(" ")}`;
      errors.push(line);
      hooks.onError?.(line);
    },
  };

  try {
    const runner = new Function("console", `"use strict";\n${code}`);
    runner(sandboxConsole);
    return { ok: true, logs, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    hooks.onError?.(message);
    return { ok: false, logs, errors, message };
  }
}

function formatArg(value) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function buildHtmlPreviewDocument(html, { injectScript = "" } = {}) {
  const base = html?.trim() || "<!DOCTYPE html><html><body></body></html>";
  if (!injectScript.trim()) {
    return base;
  }
  if (base.includes("</body>")) {
    return base.replace("</body>", `<script>${injectScript}</script></body>`);
  }
  return `${base}\n<script>${injectScript}</script>`;
}

export function inferRunMode(path, content) {
  const lower = (path || "").toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "html";
  }
  if (lower.endsWith(".json")) {
    return "json";
  }
  if (
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".py")
  ) {
    return "script";
  }
  return "script";
}

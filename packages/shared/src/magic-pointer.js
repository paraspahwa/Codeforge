const OPEN_TAG = "[ACTIVE_CURSOR_CONTEXT]";
const CLOSE_TAG = "[/ACTIVE_CURSOR_CONTEXT]";
const STORAGE_KEY = "codeforge_magic_pointer";

const DEICTIC_RULE =
  "Deictic resolution: interpret 'this', 'that', 'it', 'here', and phrases like " +
  "'this function' or 'this file' as referring to the ACTIVE_CURSOR_CONTEXT block below.";

/**
 * @param {object} params
 * @param {string} [params.filePath]
 * @param {number} [params.lineNumber]
 * @param {number} [params.selectionStartLine]
 * @param {number} [params.selectionEndLine]
 * @param {string} [params.selectionText]
 * @param {string} [params.cursorLineText]
 * @param {string} [params.surroundingContext]
 */
export function formatActiveCursorContext({
  filePath,
  lineNumber,
  selectionStartLine,
  selectionEndLine,
  selectionText,
  cursorLineText,
  surroundingContext,
}) {
  const selection = (selectionText || "").trim();
  const cursorLine = (cursorLineText || "").trim();
  if (!filePath && !selection && !cursorLine) {
    return "";
  }

  const lines = [OPEN_TAG, DEICTIC_RULE];
  if (filePath) {
    lines.push(`File: ${filePath}`);
  }
  if (lineNumber) {
    lines.push(`Line: ${lineNumber}`);
  }
  if (selectionStartLine && selectionEndLine) {
    lines.push(`Selection Range: lines ${selectionStartLine}-${selectionEndLine}`);
  }
  if (selection) {
    lines.push("Selected Text:", selection.slice(0, 4000));
  } else if (cursorLine) {
    lines.push("Cursor Line:", cursorLine.slice(0, 4000));
  }
  if (surroundingContext?.trim()) {
    lines.push("Surrounding:", surroundingContext.trim().slice(0, 4000));
  }
  lines.push(CLOSE_TAG);
  return lines.join("\n");
}

/**
 * Build surrounding lines with line numbers; `>` marks selection/cursor band.
 */
export function buildSurroundingContext(content, startLine, endLine, radius = 5) {
  if (!content) {
    return "";
  }
  const lines = content.split("\n");
  const start = Math.max(0, startLine - 1 - radius);
  const end = Math.min(lines.length, endLine + radius);
  return lines
    .slice(start, end)
    .map((line, index) => {
      const lineNo = start + index + 1;
      const marker = lineNo >= startLine && lineNo <= endLine ? ">" : " ";
      return `${marker} ${String(lineNo).padStart(4)}| ${line}`;
    })
    .join("\n");
}

export function persistMagicPointerState(payload) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, updated_at: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

export function readMagicPointerState() {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const ENTITY_RULES = [
  {
    kind: "api_route",
    pattern: /@(?:app|router)\.(?:get|post|put|patch|delete|websocket)\(["']([^"']+)/i,
    actions: ["Trace router handler", "Run API tests"],
  },
  {
    kind: "http_path",
    pattern: /["'](\/api\/[^"']+)["']/,
    actions: ["Find BFF or FastAPI route", "Check gateway nginx"],
  },
  {
    kind: "npm_missing",
    pattern: /Cannot find module ['"]([^'"]+)['"]/,
    actions: ["npm install in workspace", "Add to package.json"],
  },
  {
    kind: "pytest_failure",
    pattern: /(FAILED|AssertionError|pytest\.fail)/i,
    actions: ["npm run api:test", "Loop Engineering fix"],
  },
  {
    kind: "import_statement",
    pattern: /(?:from|import)\s+([\w.]+)/,
    actions: ["Go to definition", "Check manifest"],
  },
  {
    kind: "terminal_error",
    pattern: /(Error:|Traceback \(most recent call last\)|npm ERR!)/i,
    actions: ["Capture stderr", "Run verify loop"],
  },
];

/**
 * @param {string} text
 * @returns {{ kind: string, value: string, suggested_actions: string[] }[]}
 */
export function detectEntitiesInText(text) {
  if (!text?.trim()) {
    return [];
  }
  const found = [];
  const seen = new Set();
  for (const rule of ENTITY_RULES) {
    const matches = text.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags + "g"));
    for (const match of matches) {
      const value = match[1] || match[0];
      const key = `${rule.kind}:${value}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      found.push({ kind: rule.kind, value, suggested_actions: rule.actions });
    }
  }
  return found.slice(0, 8);
}

/**
 * @param {object} params
 * @param {string} [params.filePath]
 * @param {string} [params.content]
 * @param {{ startLine?: number, endLine?: number, text?: string } | null} [params.selection]
 * @param {{ lineNumber?: number } | null} [params.cursor]
 * @param {string} [params.hoverToken]
 */
export function buildPointerPayload({ filePath, content = "", selection, cursor, hoverToken }) {
  const lineNumber = cursor?.lineNumber || selection?.startLine || 1;
  const lines = content.split("\n");
  const cursorLineText = lines[Math.max(0, lineNumber - 1)] || "";
  const bandStart = selection?.startLine || lineNumber;
  const bandEnd = selection?.endLine || lineNumber;
  const probe = [selection?.text, cursorLineText, hoverToken].filter(Boolean).join("\n");
  return {
    file_path: filePath || null,
    line_number: lineNumber,
    selection_start_line: selection?.startLine ?? null,
    selection_end_line: selection?.endLine ?? null,
    selection_text: selection?.text ?? null,
    cursor_line_text: cursorLineText,
    hover_token: hoverToken || null,
    surrounding_context: buildSurroundingContext(content, bandStart, bandEnd, 5),
    detected_entities: detectEntitiesInText(probe),
  };
}

export { OPEN_TAG, CLOSE_TAG, STORAGE_KEY };

const STORAGE_KEY = "codeforge_ide_workspace_v1";

const DEFAULT_FILES = {
  "src/index.js": `// Run with the ▶ button or Ctrl+Shift+R
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("CodeForge"));
`,
  "src/utils.ts": `export function add(a: number, b: number): number {
  return a + b;
}
`,
  "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Preview</title>
  <style>
    body { font-family: system-ui; padding: 2rem; background: #0b1120; color: #f8fafc; }
  </style>
</head>
<body>
  <h1>Live preview</h1>
  <p id="out"></p>
  <script>
    document.getElementById("out").textContent = "Edit and click Run to refresh.";
  </script>
</body>
</html>
`,
  "data.json": `{
  "name": "codeforge-workspace",
  "version": "1.0.0"
}
`,
};

function defaultState() {
  return {
    version: 1,
    files: { ...DEFAULT_FILES },
    openTabs: ["src/index.js"],
    activePath: "src/index.js",
    editorTheme: "dark",
  };
}

export function loadIdeWorkspace() {
  if (typeof window === "undefined") {
    return defaultState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState();
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.files || typeof parsed.files !== "object") {
      return defaultState();
    }
    return {
      ...defaultState(),
      ...parsed,
      files: { ...DEFAULT_FILES, ...parsed.files },
    };
  } catch {
    return defaultState();
  }
}

export function saveIdeWorkspace(state) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        files: state.files,
        openTabs: state.openTabs,
        activePath: state.activePath,
        editorTheme: state.editorTheme,
      }),
    );
  } catch {
    // quota exceeded — ignore
  }
}

export function listFilePaths(files) {
  return Object.keys(files || {}).sort((a, b) => a.localeCompare(b));
}

export function normalizePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

export function parentFolder(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

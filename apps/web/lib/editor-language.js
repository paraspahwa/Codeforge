/** Map file paths to Monaco language IDs. */
const EXTENSION_LANGUAGE_MAP = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  pyw: "python",
  json: "json",
  jsonc: "json",
  md: "markdown",
  mdx: "markdown",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  rb: "ruby",
  php: "php",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  vue: "html",
  svelte: "html",
  dockerfile: "dockerfile",
  makefile: "makefile",
  ini: "ini",
  env: "ini",
  graphql: "graphql",
  gql: "graphql",
};

const FILENAME_LANGUAGE_MAP = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  "cmakelists.txt": "cmake",
  ".gitignore": "ini",
  ".env": "ini",
  ".env.example": "ini",
  ".env.local": "ini",
};

export function languageForPath(filePath) {
  if (!filePath) {
    return "plaintext";
  }

  const normalized = filePath.replace(/\\/g, "/");
  const baseName = normalized.split("/").pop() || "";
  const lowerName = baseName.toLowerCase();

  if (FILENAME_LANGUAGE_MAP[lowerName]) {
    return FILENAME_LANGUAGE_MAP[lowerName];
  }

  const dotIndex = lowerName.lastIndexOf(".");
  if (dotIndex === -1) {
    return "plaintext";
  }

  const extension = lowerName.slice(dotIndex + 1);
  return EXTENSION_LANGUAGE_MAP[extension] || "plaintext";
}

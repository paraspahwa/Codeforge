#!/usr/bin/env node
/**
 * Run API + web on the host without Docker (sqlite DB, no Redis/Celery).
 * Use when Docker Desktop is unavailable or for fastest UI iteration.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const env = {
  ...process.env,
  CODEFORGE_ENV: "development",
  CODEFORGE_ALLOW_DEV_LOGIN: "true",
  CODEFORGE_DEV_LOGIN_SECRET: process.env.CODEFORGE_DEV_LOGIN_SECRET || "local-dev-login-secret",
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || "local-dev-jwt-secret",
  CODEFORGE_COWORK_SCHEDULER_ENABLED: "false",
  CODEFORGE_DISABLE_PLAYWRIGHT: "true",
  CODEFORGE_CORS_ORIGINS:
    process.env.CODEFORGE_CORS_ORIGINS ||
    "http://localhost:3000,http://127.0.0.1:3000",
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000",
  CODEFORGE_PUBLIC_API_BASE: "http://127.0.0.1:8000",
};

// Force local sqlite — ignore remote Supabase URL from .env.local
delete env.DATABASE_URL;
delete env.PGHOST;
delete env.PGPORT;
delete env.PGUSER;
delete env.PGPASSWORD;
delete env.PGDATABASE;
env.REDIS_URL = "";
env.CELERY_BROKER_URL = "";
env.CELERY_RESULT_BACKEND = "";
env.QDRANT_URL = "";

const venvPython = resolve(root, "services", "api", ".venv", isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python");
const apiCmd = existsSync(venvPython) ? venvPython : isWin ? "py" : "python3";
const apiArgs = existsSync(venvPython)
  ? ["-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
  : ["-3.13", "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"];

console.log("[dev:host] Starting without Docker (sqlite API + Next.js on :3000)");
console.log("[dev:host] API:  http://localhost:8000");
console.log("[dev:host] Web:  http://localhost:3000");
console.log("[dev:host] Press Ctrl+C to stop both.\n");

const api = spawn(apiCmd, apiArgs, {
  cwd: resolve(root, "services", "api"),
  env,
  stdio: "inherit",
  shell: isWin,
});

const web = spawn(npmCmd, ["run", "dev:web:fresh"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: isWin,
});

function shutdown(code = 0) {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

api.on("exit", (code) => {
  if (code && code !== 0) console.error(`[dev:host] API exited with code ${code}`);
  shutdown(code ?? 1);
});

web.on("exit", (code) => {
  if (code && code !== 0) console.error(`[dev:host] Web exited with code ${code}`);
  shutdown(code ?? 1);
});

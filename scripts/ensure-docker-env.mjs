#!/usr/bin/env node
/**
 * Docker Compose reads `.env` in the project root (not `.env.local`).
 * Create or refresh `.env` from `.env.local` / `.env.example` when missing or still on placeholders.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env");
const localPath = resolve(root, ".env.local");
const examplePath = resolve(root, ".env.example");

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function serializeEnv(map) {
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

function isPlaceholderEnv(text) {
  return (
    /POSTGRES_PASSWORD=change-me/.test(text) ||
    /SUPABASE_JWT_SECRET=change-me/.test(text)
  );
}

function mergeFromLocal(baseText, localText) {
  const base = parseEnv(baseText);
  const local = parseEnv(localText);
  for (const [key, value] of local) {
    if (value !== "") base.set(key, value);
  }
  if (!base.has("POSTGRES_PASSWORD") || base.get("POSTGRES_PASSWORD") === "change-me") {
    base.set("POSTGRES_PASSWORD", local.get("POSTGRES_PASSWORD") || "local-dev-password");
  }
  if (!base.has("SUPABASE_JWT_SECRET") || base.get("SUPABASE_JWT_SECRET") === "change-me") {
    base.set("SUPABASE_JWT_SECRET", local.get("SUPABASE_JWT_SECRET") || "local-dev-jwt-secret");
  }
  base.set("CODEFORGE_ENV", base.get("CODEFORGE_ENV") || "development");
  base.set("CODEFORGE_ALLOW_DEV_LOGIN", base.get("CODEFORGE_ALLOW_DEV_LOGIN") || "true");
  base.set("CODEFORGE_DEV_LOGIN_SECRET", base.get("CODEFORGE_DEV_LOGIN_SECRET") || "local-dev-login-secret");
  base.set("CODEFORGE_WEB_BASE_URL", base.get("CODEFORGE_WEB_BASE_URL") || "http://localhost:3000");
  base.set(
    "CODEFORGE_CORS_ORIGINS",
    base.get("CODEFORGE_CORS_ORIGINS") ||
      "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080",
  );
  base.set("NEXT_PUBLIC_API_BASE", base.get("NEXT_PUBLIC_API_BASE") || "http://localhost:8000");
  return serializeEnv(base);
}

if (!existsSync(envPath)) {
  if (existsSync(localPath)) {
    writeFileSync(envPath, mergeFromLocal("", readFileSync(localPath, "utf8")));
    console.log("[ensure-docker-env] Created .env from .env.local for Docker Compose.");
    process.exit(0);
  }
  if (existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    console.log("[ensure-docker-env] Created .env from .env.example — set POSTGRES_PASSWORD and SUPABASE_JWT_SECRET.");
    process.exit(0);
  }
  console.error("[ensure-docker-env] No .env.local or .env.example found.");
  process.exit(1);
}

if (existsSync(localPath) && isPlaceholderEnv(readFileSync(envPath, "utf8"))) {
  const merged = mergeFromLocal(readFileSync(envPath, "utf8"), readFileSync(localPath, "utf8"));
  writeFileSync(envPath, merged);
  console.log("[ensure-docker-env] Updated .env from .env.local (replaced placeholder secrets).");
}

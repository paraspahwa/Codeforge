#!/usr/bin/env node
/** Free TCP port before starting Next dev (avoids EADDRINUSE on dev:fresh). */
import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const PORT = Number(process.env.WEB_DEV_PORT || process.env.AUDIT_WEB_PORT || 3000);
const HOST = process.env.WEB_DEV_HOST || "127.0.0.1";
const LOG_PATH = path.resolve(process.cwd(), ".cursor", "debug-46bc30.log");
const SESSION_ID = "46bc30";

function debugLog(message, data, hypothesisId = "B") {
  const entry = {
    sessionId: SESSION_ID,
    runId: process.env.DEBUG_RUN_ID || "post-fix",
    hypothesisId,
    location: "free-web-port.mjs",
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // ignore log write failures
  }
}

function portInUse(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function findPidsWindows(port) {
  const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) {
      continue;
    }
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    if (pid > 0) {
      pids.add(pid);
    }
  }
  return [...pids];
}

function findPidsUnix(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => pid > 0);
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === "win32") {
    execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
  } else {
    execSync(`kill -9 ${pid}`, { stdio: "ignore" });
  }
}

const inUse = await portInUse(HOST, PORT);
if (!inUse) {
  debugLog("port already free", { port: PORT, host: HOST });
  process.exit(0);
}

const pids = process.platform === "win32" ? findPidsWindows(PORT) : findPidsUnix(PORT);
debugLog("port in use before kill", { port: PORT, pids });

if (pids.length === 0) {
  console.error(`[free-web-port] Port ${PORT} appears busy but no listener PID found.`);
  process.exit(1);
}

for (const pid of pids) {
  try {
    killPid(pid);
    console.log(`[free-web-port] Stopped process ${pid} on port ${PORT}`);
  } catch (error) {
    console.error(`[free-web-port] Failed to stop PID ${pid}: ${error.message}`);
    process.exit(1);
  }
}

await new Promise((r) => setTimeout(r, 500));
const stillInUse = await portInUse(HOST, PORT);
debugLog("port after kill", { port: PORT, stillInUse, pids });
if (stillInUse) {
  console.error(`[free-web-port] Port ${PORT} is still in use after kill attempt.`);
  process.exit(1);
}

console.log(`[free-web-port] Port ${PORT} is free.`);

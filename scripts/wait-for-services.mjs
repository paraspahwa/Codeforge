#!/usr/bin/env node
/** Poll web (and optionally API) until ready before audit/smoke. */
const WEB_BASE = process.env.WEB_BASE || "http://localhost:3000";
const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const WAIT_MS = Number(process.env.AUDIT_WAIT_MS || 120000);
const INTERVAL_MS = Number(process.env.AUDIT_POLL_MS || 2000);
const SKIP_API = process.env.AUDIT_SKIP_API === "1";

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

const deadline = Date.now() + WAIT_MS;
let attempt = 0;

while (Date.now() < deadline) {
  attempt += 1;
  const webOk = await probe(WEB_BASE);
  const apiOk = SKIP_API ? true : await probe(`${API_BASE}/health`);
  if (webOk && apiOk) {
    console.log(`[wait-for-services] Ready after ${attempt} attempt(s) — web=${WEB_BASE} api=${SKIP_API ? "skipped" : API_BASE}`);
    process.exit(0);
  }
  const remaining = Math.max(0, deadline - Date.now());
  console.log(
    `[wait-for-services] attempt ${attempt}: web=${webOk ? "ok" : "waiting"} api=${SKIP_API ? "skip" : apiOk ? "ok" : "waiting"} (${Math.round(remaining / 1000)}s left)`,
  );
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}

console.error(`[wait-for-services] Timed out after ${WAIT_MS}ms waiting for services.`);
process.exit(1);

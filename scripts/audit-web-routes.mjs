#!/usr/bin/env node
/** HTTP audit for CodeForge web routes (CSS + shell markers). */
const BASE = process.env.WEB_BASE || "http://localhost:3000";
const ROUTE_TIMEOUT_MS = Number(process.env.AUDIT_ROUTE_TIMEOUT_MS || 30000);
const WAIT_MS = Number(process.env.AUDIT_WAIT_MS || 0);
const SKIP_WAIT = process.env.AUDIT_SKIP_WAIT === "1";

const ROUTES = [
  { path: "/", expect: "marketing", note: "landing" },
  { path: "/roadmap", expect: "marketing" },
  { path: "/case-studies", expect: "marketing" },
  { path: "/pricing", expect: "marketing" },
  { path: "/about", expect: "marketing" },
  { path: "/privacy", expect: "marketing" },
  { path: "/terms", expect: "marketing" },
  { path: "/login", expect: "minimal" },
  { path: "/auth/callback", expect: "minimal" },
  { path: "/app", expect: "app" },
  { path: "/agents", expect: "app" },
  { path: "/features", expect: "app" },
  { path: "/extensions", expect: "app" },
  { path: "/mcp", expect: "app" },
  { path: "/cowork", expect: "app" },
  { path: "/sessions", expect: "app" },
  { path: "/team", expect: "app" },
  { path: "/analytics", expect: "app" },
  { path: "/settings", expect: "app" },
  { path: "/billing", expect: "app" },
  { path: "/mobile", expect: "app" },
  { path: "/code", expect: "app" },
  { path: "/share/demo-share", expect: "minimal", note: "public share" },
];

function shellMarkers(html, expect) {
  if (expect === "marketing") {
    return html.includes("marketing-shell") || html.includes("marketing-main");
  }
  if (expect === "app") {
    return (
      html.includes("app-shell") ||
      html.includes("/login?next=") ||
      html.includes('pathname":"/login"')
    );
  }
  return html.includes("minimal-shell") || html.includes("login");
}

async function waitForWeb() {
  if (SKIP_WAIT || WAIT_MS <= 0) {
    return;
  }
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        return;
      }
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Web server not ready at ${BASE} within ${WAIT_MS}ms`);
}

async function auditRoute({ path, expect, note }) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
    });
    const html = await res.text();
    const cssMatch = html.match(/href="(\/_next\/static\/css\/[^"]+)"/);
    let cssStatus = "missing";
    if (cssMatch) {
      const cssRes = await fetch(`${BASE}${cssMatch[1]}`, {
        signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
      });
      cssStatus = cssRes.ok ? "200" : String(cssRes.status);
    }
    const shellOk = shellMarkers(html, expect);
    const loginRedirect = res.url.includes("/login");
    const pass = res.ok && cssStatus === "200" && (shellOk || loginRedirect);
    return {
      path,
      note,
      status: res.status,
      css: cssStatus,
      shell: shellOk ? expect : loginRedirect ? "redirect-login" : "missing",
      pass,
    };
  } catch (err) {
    return { path, note, status: "ERR", css: "-", shell: "-", pass: false, error: err.message };
  }
}

function printTable(results) {
  const header = ["path", "status", "css", "shell", "pass"].join("\t");
  console.log("\n--- Route audit ---");
  console.log(header);
  for (const row of results) {
    console.log([row.path, row.status, row.css, row.shell, row.pass ? "PASS" : "FAIL"].join("\t"));
  }
}

await waitForWeb();

const results = [];
for (const route of ROUTES) {
  results.push(await auditRoute(route));
}

const failed = results.filter((r) => !r.pass);
const summary = {
  base: BASE,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
};

printTable(results);
console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length > 0 ? 1 : 0);

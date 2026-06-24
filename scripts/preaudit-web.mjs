#!/usr/bin/env node
/** Guard: warn if port 3000 is in use before running route audit. */
import net from "node:net";

const PORT = Number(process.env.AUDIT_WEB_PORT || 3000);
const HOST = process.env.AUDIT_WEB_HOST || "127.0.0.1";
const STRICT = process.env.PREAUDIT_STRICT === "1";

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

const inUse = await portInUse(HOST, PORT);
if (!inUse) {
  console.error(
    `[preaudit] Nothing is listening on http://${HOST}:${PORT}.\n` +
      "Start the web app first:\n" +
      "  npm run dev:all\n" +
      "  # or: npm run stack:up && npm run dev:web:fresh\n" +
      "For CI, use: npm run build:web && npm run start:web",
  );
  process.exit(STRICT ? 1 : 0);
}

console.log(`[preaudit] Port ${PORT} is in use — proceeding with audit.`);

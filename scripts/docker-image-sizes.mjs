#!/usr/bin/env node
/**
 * Print Docker image sizes for CodeForge stack images (codeforge / indi-claude).
 * Run after: docker compose -f docker-compose.dev.yml build
 */
import { execSync } from "node:child_process";

const filters = ["codeforge", "indi-claude"];

function parseDockerImages(output) {
  const lines = output.trim().split("\n").filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const parts = line.split(/\s{2,}/);
    return {
      repository: parts[0] ?? "",
      tag: parts[1] ?? "",
      size: parts[3] ?? parts[parts.length - 1] ?? "",
      id: parts[2] ?? "",
    };
  });
}

function matchesFilter(name) {
  const lower = name.toLowerCase();
  return filters.some((f) => lower.includes(f));
}

let raw = "";
try {
  raw = execSync('docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"', {
    encoding: "utf8",
  });
} catch (err) {
  console.error("Failed to run docker images. Is Docker running?");
  process.exit(1);
}

const rows = parseDockerImages(raw).filter((r) => matchesFilter(`${r.repository}:${r.tag}`));

if (rows.length === 0) {
  console.log("No images matching codeforge or indi-claude. Build the stack first:");
  console.log("  docker compose -f docker-compose.dev.yml build");
  process.exit(0);
}

const col = (s, w) => String(s).padEnd(w);
const repoW = Math.max(12, ...rows.map((r) => r.repository.length));
const tagW = Math.max(8, ...rows.map((r) => r.tag.length));
const sizeW = Math.max(8, ...rows.map((r) => r.size.length));

console.log("");
console.log(`${col("REPOSITORY", repoW)}  ${col("TAG", tagW)}  ${col("SIZE", sizeW)}`);
console.log(`${"-".repeat(repoW)}  ${"-".repeat(tagW)}  ${"-".repeat(sizeW)}`);
for (const r of rows.sort((a, b) => a.repository.localeCompare(b.repository))) {
  console.log(`${col(r.repository, repoW)}  ${col(r.tag, tagW)}  ${col(r.size, sizeW)}`);
}
console.log("");

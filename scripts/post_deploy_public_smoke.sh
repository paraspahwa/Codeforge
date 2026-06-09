#!/usr/bin/env bash
# Post-deploy synthetic checks against public API and web URLs.
set -euo pipefail

API_URL="${1:?API public origin required, e.g. https://api-staging.example.com}"
WEB_URL="${2:?Web public origin required, e.g. https://staging.example.com}"

API_URL="${API_URL%/}"
WEB_URL="${WEB_URL%/}"

echo "Checking API health: ${API_URL}/health"
curl -fsS "${API_URL}/health" >/tmp/post-deploy-health.json
cat /tmp/post-deploy-health.json

echo "Checking deploy readiness (probes): ${API_URL}/api/v1/platform/deploy-readiness"
curl -fsS "${API_URL}/api/v1/platform/deploy-readiness?probe_discovery=true&probe_billing=true&probe_vector=true" >/tmp/post-deploy-readiness.json

python - <<'PY'
import json
import sys

payload = json.load(open("/tmp/post-deploy-readiness.json", encoding="utf-8"))
if not payload.get("ready", False):
    failed = [c["name"] for c in payload.get("checks", []) if c.get("required", True) and not c.get("ok")]
    print("Post-deploy deploy-readiness failed:", ", ".join(failed) or "unknown")
    sys.exit(1)
print("Post-deploy deploy-readiness passed")
PY

echo "Checking stack status: ${API_URL}/api/v1/platform/stack-status"
curl -fsS "${API_URL}/api/v1/platform/stack-status" >/tmp/post-deploy-stack.json

python - <<'PY'
import json
import sys

payload = json.load(open("/tmp/post-deploy-stack.json", encoding="utf-8"))
issues = []
if not payload.get("redis", {}).get("healthy", False):
    issues.append("redis unhealthy")
if not payload.get("task_queue", {}).get("healthy", False):
    issues.append("task_queue unhealthy")
if payload.get("redis", {}).get("backend") == "memory":
    issues.append("redis backend is memory")
if payload.get("task_queue", {}).get("backend") == "inline":
    issues.append("task queue backend is inline")
if not payload.get("vector_store", {}).get("healthy", False):
    issues.append("vector_store unhealthy")
if payload.get("vector_store", {}).get("backend") == "memory":
    issues.append("vector_store backend is memory")
if issues:
    print("Post-deploy stack-status degraded:", "; ".join(issues))
    sys.exit(1)
print("Post-deploy stack-status passed")
PY

echo "Checking web origin: ${WEB_URL}/"
curl -fsSI "${WEB_URL}/" | head -n 1

echo "Post-deploy public smoke checks passed"

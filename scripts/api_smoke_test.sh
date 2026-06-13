#!/usr/bin/env bash
# Smoke-test core CodeForge API endpoints (run on EC2 or against public IP).
set -euo pipefail

API_BASE="${1:-http://127.0.0.1:8000}"
API_BASE="${API_BASE%/}"

pass() { printf '  ✓ %s\n' "$1"; }
fail() { printf '  ✗ %s\n' "$1"; FAILED=1; }

FAILED=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "API smoke tests: $API_BASE"

echo "1. Health"
if curl -fsS "$API_BASE/health" >"$TMP/health.json"; then
  pass "/health"
else
  fail "/health"
fi

echo "2. Dev login"
if curl -fsS -X POST "$API_BASE/api/v1/auth/dev-login" \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"smoke-user"}' >"$TMP/login.json"; then
  pass "POST /api/v1/auth/dev-login"
else
  fail "POST /api/v1/auth/dev-login"
fi

TOKEN=$(python3 -c "import json; print(json.load(open('$TMP/login.json'))['access_token'])" 2>/dev/null || echo "")
if [[ -z "$TOKEN" ]]; then
  echo "No token; aborting authenticated tests."
  exit 1
fi
AUTH=(-H "Authorization: Bearer $TOKEN")

echo "3. Platform"
for path in deploy-readiness stack-status; do
  if curl -fsS "${AUTH[@]}" "$API_BASE/api/v1/platform/$path" >"$TMP/$path.json"; then
    pass "GET /api/v1/platform/$path"
  else
    fail "GET /api/v1/platform/$path"
  fi
done

echo "4. Sessions"
if curl -fsS -X POST "${AUTH[@]}" "$API_BASE/api/v1/sessions" \
  -H 'Content-Type: application/json' \
  -d '{"project_path":"/workspaces/demo","model_preference":"auto"}' >"$TMP/session.json"; then
  pass "POST /api/v1/sessions"
else
  fail "POST /api/v1/sessions"
fi

SESSION_ID=$(python3 -c "import json; print(json.load(open('$TMP/session.json'))['session_id'])" 2>/dev/null || echo "")
if [[ -z "$SESSION_ID" ]]; then
  echo "No session_id; aborting message tests."
  exit 1
fi

if curl -fsS "${AUTH[@]}" "$API_BASE/api/v1/sessions" >"$TMP/sessions.json"; then
  pass "GET /api/v1/sessions"
else
  fail "GET /api/v1/sessions"
fi

echo "5. Messages"
if curl -fsS -X POST "${AUTH[@]}" "$API_BASE/api/v1/sessions/$SESSION_ID/messages" \
  -H 'Content-Type: application/json' \
  -d '{"content":"Hello from smoke test","intent":"chat"}' >"$TMP/message.json"; then
  pass "POST /api/v1/sessions/$SESSION_ID/messages"
else
  fail "POST /api/v1/sessions/$SESSION_ID/messages"
  docker logs codeforge-api --tail 20 2>&1 || true
fi

if curl -fsS "${AUTH[@]}" "$API_BASE/api/v1/sessions/$SESSION_ID/messages" >"$TMP/messages.json"; then
  pass "GET /api/v1/sessions/$SESSION_ID/messages"
else
  fail "GET /api/v1/sessions/$SESSION_ID/messages"
fi

echo "6. Usage & billing"
if curl -fsS "${AUTH[@]}" "$API_BASE/api/v1/usage/summary" >"$TMP/usage.json"; then
  pass "GET /api/v1/usage/summary"
else
  fail "GET /api/v1/usage/summary"
fi

if curl -fsS "$API_BASE/api/v1/billing/plans" >"$TMP/plans.json"; then
  pass "GET /api/v1/billing/plans"
else
  fail "GET /api/v1/billing/plans"
fi

echo "7. Queue ping"
if curl -fsS -X POST "${AUTH[@]}" "$API_BASE/api/v1/platform/queue-ping" >"$TMP/ping.json"; then
  pass "POST /api/v1/platform/queue-ping"
else
  fail "POST /api/v1/platform/queue-ping"
fi

if [[ "$FAILED" -eq 0 ]]; then
  echo "All API smoke tests passed."
else
  echo "Some API smoke tests failed."
  exit 1
fi

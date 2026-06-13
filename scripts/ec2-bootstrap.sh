#!/usr/bin/env bash
# Bootstrap CodeForge on Ubuntu EC2 (Phases 2–7 from EC2_Runbook.md).
# Installs Docker, clones the repo, writes .env + compose override, builds, and starts the stack.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_URL="https://github.com/paraspahwa/Indi-claude.git"
DEFAULT_REPO_DIR="${HOME}/Indi-claude"
COMPOSE_FILE="docker-compose.prod.yml"

REPO_URL="${CODEFORGE_REPO_URL:-$DEFAULT_REPO_URL}"
REPO_DIR="${CODEFORGE_REPO_DIR:-$DEFAULT_REPO_DIR}"
EC2_IP="${CODEFORGE_EC2_IP:-}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"

SKIP_DOCKER_INSTALL=false
SKIP_CLONE=false
FORCE_ENV=false
SKIP_BUILD=false
SKIP_UP=false

log() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: scripts/ec2-bootstrap.sh [options]

Automates EC2 Phases 2–7 on Ubuntu 24.04: Docker install, clone, .env, override,
web build with public API URL, and docker compose up.

Options:
  --repo-url URL          Git clone URL (default: paraspahwa/Indi-claude)
  --repo-dir PATH         Clone / working directory (default: ~/Indi-claude)
  --ec2-ip IP             Public IPv4 (default: EC2 instance metadata)
  --postgres-password P   POSTGRES_PASSWORD (default: random)
  --supabase-jwt-secret S SUPABASE_JWT_SECRET (default: random)
  --openai-api-key KEY    OPENAI_API_KEY written into .env (optional)
  --skip-docker-install   Skip apt Docker install (already installed)
  --skip-clone            Skip git clone (repo already present)
  --force-env             Regenerate EC2 URL vars in existing .env
  --skip-build            Skip docker compose build steps
  --skip-up               Skip docker compose up
  -h, --help              Show this help

Environment overrides: CODEFORGE_REPO_URL, CODEFORGE_REPO_DIR, CODEFORGE_EC2_IP,
POSTGRES_PASSWORD, SUPABASE_JWT_SECRET, OPENAI_API_KEY

Examples:
  curl -fsSL https://raw.githubusercontent.com/paraspahwa/Indi-claude/main/scripts/ec2-bootstrap.sh | bash
  ./scripts/ec2-bootstrap.sh --openai-api-key sk-...
  ./scripts/ec2-bootstrap.sh --skip-docker-install --skip-clone
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo-url) REPO_URL="${2:?--repo-url requires a value}"; shift 2 ;;
      --repo-dir) REPO_DIR="${2:?--repo-dir requires a value}"; shift 2 ;;
      --ec2-ip) EC2_IP="${2:?--ec2-ip requires a value}"; shift 2 ;;
      --postgres-password) POSTGRES_PASSWORD="${2:?--postgres-password requires a value}"; shift 2 ;;
      --supabase-jwt-secret) SUPABASE_JWT_SECRET="${2:?--supabase-jwt-secret requires a value}"; shift 2 ;;
      --openai-api-key) OPENAI_API_KEY="${2:?--openai-api-key requires a value}"; shift 2 ;;
      --skip-docker-install) SKIP_DOCKER_INSTALL=true; shift ;;
      --skip-clone) SKIP_CLONE=true; shift ;;
      --force-env) FORCE_ENV=true; shift ;;
      --skip-build) SKIP_BUILD=true; shift ;;
      --skip-up) SKIP_UP=true; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "unknown option: $1 (try --help)" ;;
    esac
  done
}

detect_repo_dir_from_cwd() {
  if [[ -f "${PWD}/${COMPOSE_FILE}" ]]; then
    REPO_DIR="$PWD"
    SKIP_CLONE=true
    return
  fi
  if [[ -f "${SCRIPT_DIR}/../${COMPOSE_FILE}" ]]; then
    REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
    SKIP_CLONE=true
  fi
}

random_hex() {
  local nbytes="${1:-16}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$nbytes"
    return
  fi
  head -c "$nbytes" /dev/urandom | od -An -tx1 | tr -d ' \n'
}

detect_ec2_ip() {
  if [[ -n "$EC2_IP" ]]; then
    log "Using EC2 public IP from argument/env: $EC2_IP"
    return
  fi
  EC2_IP="$(curl -fsS --connect-timeout 2 -m 5 \
    http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)"
  if [[ -z "$EC2_IP" ]]; then
    die "Could not detect EC2 public IP. Pass --ec2-ip or set CODEFORGE_EC2_IP."
  fi
  log "Detected EC2 public IP: $EC2_IP"
}

require_ubuntu() {
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    if [[ "${ID:-}" == "ubuntu" ]]; then
      return
    fi
    warn "This script targets Ubuntu 24.04. Detected: ${PRETTY_NAME:-unknown}. Continuing anyway."
    return
  fi
  warn "Could not read /etc/os-release; assuming Ubuntu-compatible host."
}

install_docker_ubuntu() {
  if [[ "$SKIP_DOCKER_INSTALL" == "true" ]]; then
    log "Skipping Docker install (--skip-docker-install)"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker and Compose already installed"
    return
  fi
  log "Installing Docker, Compose v2, git, and curl (Ubuntu apt)"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker.io docker-compose-v2 git curl ca-certificates
  sudo systemctl enable --now docker
  if ! id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
    sudo usermod -aG docker "$USER"
    log "Added $USER to docker group (effective on next login; using sudo for docker this run)"
  fi
}

docker_cmd() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    sudo docker compose "$@"
  fi
}

ensure_repo() {
  if [[ "$SKIP_CLONE" == "true" && -f "${REPO_DIR}/${COMPOSE_FILE}" ]]; then
    log "Using existing repo at ${REPO_DIR}"
    return
  fi
  if [[ -d "${REPO_DIR}/.git" ]]; then
    log "Repo exists at ${REPO_DIR}; pulling latest"
    git -C "$REPO_DIR" pull --ff-only
    return
  fi
  log "Cloning ${REPO_URL} into ${REPO_DIR}"
  git clone "$REPO_URL" "$REPO_DIR"
}

upsert_env_file() {
  local env_file="${REPO_DIR}/.env"
  local postgres="${1}"
  local jwt_secret="${2}"
  local openai_key="${3}"

  if [[ ! -f "${REPO_DIR}/.env.example" ]]; then
    die "Missing ${REPO_DIR}/.env.example"
  fi

  if [[ -f "$env_file" && "$FORCE_ENV" != "true" ]]; then
    log "Keeping existing .env (use --force-env to rewrite EC2 URL vars)"
    # Ensure required secrets are not placeholders if compose would fail.
    if grep -q '^POSTGRES_PASSWORD=change-me' "$env_file" 2>/dev/null; then
      warn ".env still has POSTGRES_PASSWORD=change-me; set a real password or re-run with --force-env"
    fi
    return
  fi

  if [[ ! -f "$env_file" ]]; then
    cp "${REPO_DIR}/.env.example" "$env_file"
  fi

  python3 - "$env_file" "$EC2_IP" "$postgres" "$jwt_secret" "$openai_key" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
ec2_ip = sys.argv[2]
postgres = sys.argv[3]
jwt_secret = sys.argv[4]
openai_key = sys.argv[5]

web_origin = f"http://{ec2_ip}:3000"
api_origin = f"http://{ec2_ip}:8000"

updates = {
    "POSTGRES_PASSWORD": postgres,
    "SUPABASE_JWT_SECRET": jwt_secret,
    "CODEFORGE_ALLOW_DEV_LOGIN": "true",
    "CODEFORGE_ENV": "production",
    "RAZORPAY_KEY_ID": "rzp_test_local",
    "RAZORPAY_KEY_SECRET": "local_razorpay_secret",
    "CODEFORGE_CORS_ORIGINS": web_origin,
    "CODEFORGE_WEB_BASE_URL": web_origin,
    "CODEFORGE_PUBLIC_API_BASE": api_origin,
    "NEXT_PUBLIC_API_BASE": api_origin,
    "CODEFORGE_HOST_WORKSPACES": "./workspaces",
    "CODEFORGE_SYNTHESIS_MODEL": "gpt-4o-mini",
}
if openai_key:
    updates["OPENAI_API_KEY"] = openai_key

lines = path.read_text(encoding="utf-8").splitlines()
out = []
seen = set()
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    key, _ = line.split("=", 1)
    if key in updates:
        out.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        out.append(line)

for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")

path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY
  log "Wrote ${env_file} with EC2 URLs for ${EC2_IP}"
}

write_compose_override() {
  local override="${REPO_DIR}/docker-compose.override.yml"
  cat >"$override" <<'EOF'
services:
  api:
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL:-https://api.openai.com/v1}
      CODEFORGE_SYNTHESIS_MODEL: ${CODEFORGE_SYNTHESIS_MODEL:-gpt-4o-mini}
      CODEFORGE_EMBEDDING_MODEL: ${CODEFORGE_EMBEDDING_MODEL:-text-embedding-3-small}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      CODEFORGE_SCRAPE_ENABLED: ${CODEFORGE_SCRAPE_ENABLED:-true}
  worker:
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL:-https://api.openai.com/v1}
      CODEFORGE_SYNTHESIS_MODEL: ${CODEFORGE_SYNTHESIS_MODEL:-gpt-4o-mini}
      CODEFORGE_SCRAPE_ENABLED: ${CODEFORGE_SCRAPE_ENABLED:-true}
EOF
  log "Wrote ${override}"
}

build_and_up() {
  cd "$REPO_DIR"
  mkdir -p workspaces

  if [[ "$SKIP_BUILD" != "true" ]]; then
    log "Building web image with NEXT_PUBLIC_API_BASE=http://${EC2_IP}:8000"
    compose_cmd -f "$COMPOSE_FILE" build \
      --build-arg "NEXT_PUBLIC_API_BASE=http://${EC2_IP}:8000" \
      web
  fi

  if [[ "$SKIP_UP" != "true" ]]; then
    log "Starting full stack (docker compose up -d --build)"
    compose_cmd -f "$COMPOSE_FILE" up -d --build
    log "Ensuring Postgres schema"
    sleep 5
    docker exec codeforge-api python3 -c "from app.db import init_db; init_db()" 2>/dev/null || true
  fi
}

wait_for_health() {
  local url="http://${EC2_IP}:8000/health"
  log "Waiting for API health at ${url}"
  local attempt
  for attempt in $(seq 1 36); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "API health check passed"
      curl -fsS "$url"
      echo
      return 0
    fi
    sleep 5
  done
  warn "API did not become healthy within ~3 minutes. Check: docker compose -f ${COMPOSE_FILE} logs api"
  return 1
}

print_summary() {
  cat <<EOF

CodeForge EC2 bootstrap finished.

  Web UI:  http://${EC2_IP}:3000
  API:     http://${EC2_IP}:8000
  Repo:    ${REPO_DIR}

Next steps (from laptop or EC2):
  curl -fsS http://${EC2_IP}:8000/health
  curl -fsS http://${EC2_IP}:8000/api/v1/platform/deploy-readiness | python3 -m json.tool
  curl -fsS http://${EC2_IP}:8000/api/v1/platform/stack-status | python3 -m json.tool

  docker compose -f ${COMPOSE_FILE} ps
  docker compose -f ${COMPOSE_FILE} logs -f api

See EC2_Runbook.md Phase 8–9 for full smoke tests and browser checks.
EOF
}

main() {
  parse_args "$@"
  detect_repo_dir_from_cwd
  require_ubuntu
  detect_ec2_ip

  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(random_hex 16)}"
  SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET:-$(random_hex 32)}"

  install_docker_ubuntu
  ensure_repo
  upsert_env_file "$POSTGRES_PASSWORD" "$SUPABASE_JWT_SECRET" "$OPENAI_API_KEY"
  write_compose_override
  build_and_up

  compose_cmd -f "${REPO_DIR}/${COMPOSE_FILE}" ps || true

  if [[ "$SKIP_UP" != "true" ]]; then
    wait_for_health || true
  fi

  print_summary
}

main "$@"

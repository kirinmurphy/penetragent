#!/bin/bash

# Auto-rebuild hook for Claude Code
# Checks if Docker containers need rebuilding, calls rebuild.sh if so

set -e

cd "$(dirname "$0")/.."

LOG_FILE="$(pwd)/.claude/hooks/auto-rebuild.log"
SCRIPTS_DIR="$(dirname "$0")"

log_check() { echo "$1" >> "$LOG_FILE"; }

log_check ""
log_check "=== Hook triggered at $(date) ==="

if ! docker info > /dev/null 2>&1; then
  log_check "✗ Docker is not running, skipping rebuild check"
  exit 0
fi

SCANNER_RUNNING=$(docker ps --filter "name=infra-scanner-1" --format "{{.Names}}" 2>/dev/null || true)
CONTROLLER_RUNNING=$(docker ps --filter "name=infra-controller-1" --format "{{.Names}}" 2>/dev/null || true)

if [ -z "$SCANNER_RUNNING" ] && [ -z "$CONTROLLER_RUNNING" ]; then
  log_check "✗ No containers running, skipping rebuild"
  exit 0
fi

CHANGED_FILES=$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u )

if [ -z "$CHANGED_FILES" ]; then
  log_check "✓ No uncommitted changes found"
  exit 0
fi

REBUILD_PATTERNS=(
  "package(-lock)?\.json$:Dependency changes"
  "\.nvmrc$|\.node-version$:Node version changes"
  "^(Dockerfile|docker-compose|infra/):Docker/infrastructure changes"
  "\.dockerignore$:Docker ignore changes"
  "tsconfig.*\.json$:TypeScript config changes"
  "\.swcrc$|\.babelrc:Build tool config changes"
  "^shared/src/:Shared package changes"
  "^scanner/src/db/:Database schema changes"
  "\.env:Environment variable changes"
  "^scripts/(startup|init|entrypoint):Startup script changes"
)

REBUILD_REASON=""
for pattern_entry in "${REBUILD_PATTERNS[@]}"; do
  pattern="${pattern_entry%%:*}"
  reason="${pattern_entry##*:}"

  if echo "$CHANGED_FILES" | grep -q -E "$pattern"; then
    REBUILD_REASON="$reason"
    break
  fi
done

if [ -z "$REBUILD_REASON" ]; then
  log_check "✓ No rebuild needed"
  exit 0
fi

log_check "→ Rebuild needed: $REBUILD_REASON"

exec "$SCRIPTS_DIR/rebuild.sh" "$REBUILD_REASON" "$CHANGED_FILES"

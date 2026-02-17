#!/bin/bash

# Auto-rebuild hook for Claude Code
# Runs when Claude finishes responding and determines if Docker containers need rebuilding

set -e

# Change to project root first (needed for relative paths)
cd "$(dirname "$0")/../.."

# Setup logging
LOG_FILE="$(pwd)/.claude/hooks/auto-rebuild.log"
CONTEXT_FILE="$(pwd)/.claude/hooks/work-context.txt"

# Phase 1: Check phase — no exec redirect, just append to log quietly
log_check() { echo "$1" >> "$LOG_FILE"; }

log_check ""
log_check "=== Hook triggered at $(date) ==="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  log_check "✗ Docker is not running, skipping rebuild check"
  exit 0
fi

# Check if containers are running
SCANNER_RUNNING=$(docker ps --filter "name=infra-scanner-1" --format "{{.Names}}" 2>/dev/null || true)
CONTROLLER_RUNNING=$(docker ps --filter "name=infra-controller-1" --format "{{.Names}}" 2>/dev/null || true)

if [ -z "$SCANNER_RUNNING" ] && [ -z "$CONTROLLER_RUNNING" ]; then
  log_check "✗ No containers running, skipping rebuild"
  exit 0
fi

# Check for uncommitted changes
CHANGED_FILES=$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u )

if [ -z "$CHANGED_FILES" ]; then
  log_check "✓ No uncommitted changes found"
  exit 0
fi

# Define patterns that require rebuild (pattern:reason)
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

# Check if any pattern matches
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

# Phase 2: Rebuild detected — clear log and use single exec redirect
> "$LOG_FILE"
exec > >(tee "$LOG_FILE") 2>&1
echo "=== Rebuild at $(date) ==="
echo ""

if [ -f "$CONTEXT_FILE" ]; then
  echo "Work context:"
  sed 's/^/  /' "$CONTEXT_FILE"
  rm -f "$CONTEXT_FILE"
  echo ""
fi

echo "Rebuild reason: $REBUILD_REASON"
echo "Changed files:"
echo "$CHANGED_FILES" | sed 's/^/  - /'
echo ""
echo "Running: npm run docker:down && npm run docker:dev:build"

# Stop containers
npm run docker:down > /dev/null 2>&1 || true

# Rebuild and start — wait for build to finish before checking health
echo "Building containers..."
if ! npm run docker:dev:build > /dev/null 2>&1; then
  echo "✗ Build failed"
  exit 1
fi
echo "✓ Build complete"

# Wait for containers to become healthy (max 90 seconds)
echo "Waiting for containers to be healthy..."
HEALTHY=false
for i in {1..90}; do
  SCANNER_UP=$(docker ps --filter "name=infra-scanner-1" --filter "status=running" --format "{{.Names}}" 2>/dev/null || true)
  CONTROLLER_UP=$(docker ps --filter "name=infra-controller-1" --filter "status=running" --format "{{.Names}}" 2>/dev/null || true)
  if [ -n "$SCANNER_UP" ] && [ -n "$CONTROLLER_UP" ]; then
    HEALTHY=true
    echo "✓ Both containers running (${i}s)"
    break
  fi
  sleep 1
done

if [ "$HEALTHY" = false ]; then
  echo "✗ Containers failed to start within 90 seconds"
  docker ps -a --filter "name=infra-" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
  exit 1
fi

SCANNER_URL="http://127.0.0.1:8080"
SMOKE_TARGET="https://httpbin.org"
SMOKE_POLL_MAX=120

echo ""
echo "--- Scanner smoke test ---"

# 1. Health check — wait for scanner to be ready to serve requests
echo "Checking /health..."
HEALTH_OK=false
for i in {1..15}; do
  HEALTH=$(curl -sf "${SCANNER_URL}/health" 2>/dev/null || true)
  if echo "$HEALTH" | grep -q '"ok":true'; then
    HEALTH_OK=true
    break
  fi
  sleep 1
done
if [ "$HEALTH_OK" = false ]; then
  echo "✗ /health did not return ok:true"
  exit 1
fi
echo "✓ /health ok"

# 2. Submit scan
echo "Submitting scan for ${SMOKE_TARGET}..."
SCAN_RESPONSE=$(curl -sf -X POST "${SCANNER_URL}/scan" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${SMOKE_TARGET}\",\"requestedBy\":\"smoke-test\"}" 2>/dev/null || true)

JOB_ID=$(echo "$SCAN_RESPONSE" | grep -o '"jobId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
  echo "✗ Failed to create scan job"
  echo "  Response: $SCAN_RESPONSE"
  exit 1
fi
echo "✓ Job created: ${JOB_ID}"

# 3. Poll until SUCCEEDED or FAILED
echo "Polling job status (max ${SMOKE_POLL_MAX}s)..."
FINAL_STATUS=""
for i in $(seq 1 "$SMOKE_POLL_MAX"); do
  JOB_JSON=$(curl -sf "${SCANNER_URL}/jobs/${JOB_ID}" 2>/dev/null || true)
  STATUS=$(echo "$JOB_JSON" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ "$STATUS" = "SUCCEEDED" ] || [ "$STATUS" = "FAILED" ]; then
    FINAL_STATUS="$STATUS"
    echo "  Job reached ${STATUS} after ${i}s"
    break
  fi

  if [ $((i % 10)) -eq 0 ]; then
    echo "  ...${i}s (status: ${STATUS:-unknown})"
  fi
  sleep 1
done

if [ -z "$FINAL_STATUS" ]; then
  echo "✗ Job did not complete within ${SMOKE_POLL_MAX}s"
  exit 1
fi

if [ "$FINAL_STATUS" = "FAILED" ]; then
  ERROR_MSG=$(echo "$JOB_JSON" | grep -o '"errorMessage":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "✗ Scan failed: ${ERROR_MSG}"
  exit 1
fi

# 4. Verify response has expected fields
HAS_SUMMARY=$(echo "$JOB_JSON" | grep -c '"summaryJson"' || true)
HAS_PAGES=$(echo "$JOB_JSON" | grep -c '"pagesScanned"' || true)

if [ "$HAS_SUMMARY" -eq 0 ] || [ "$HAS_PAGES" -eq 0 ]; then
  echo "✗ Job response missing expected fields (summaryJson, pagesScanned)"
  echo "  Response: $JOB_JSON"
  exit 1
fi
echo "✓ Job response has summaryJson with pagesScanned"

# 5. Verify HTML report is accessible
HTML_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${SCANNER_URL}/reports/${JOB_ID}/html" 2>/dev/null || echo "000")
if [ "$HTML_STATUS" = "200" ]; then
  echo "✓ HTML report accessible (200)"
else
  echo "✗ HTML report returned status ${HTML_STATUS}"
  exit 1
fi

# 6. Clean up the smoke test job
curl -sf -X DELETE "${SCANNER_URL}/jobs/${JOB_ID}" > /dev/null 2>&1 || true
echo "✓ Smoke test job cleaned up"

echo ""
echo "✓ Auto-rebuild complete (with smoke test)"
echo "=== Hook completed successfully ==="
exit 0

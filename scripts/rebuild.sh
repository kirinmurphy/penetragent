#!/bin/bash

# Rebuilds Docker containers and runs smoke test
# Called by auto-rebuild.sh or can be run directly
# Usage: rebuild.sh [reason] [changed_files]

set -e

cd "$(dirname "$0")/.."

LOG_FILE="$(pwd)/.claude/hooks/auto-rebuild.log"
CONTEXT_FILE="$(pwd)/.claude/hooks/work-context.txt"
REBUILD_REASON="${1:-Manual rebuild}"
CHANGED_FILES="${2:-}"

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
if [ -n "$CHANGED_FILES" ]; then
  echo "Changed files:"
  echo "$CHANGED_FILES" | sed 's/^/  - /'
  echo ""
fi

echo "Running: npm run docker:down && npm run docker:dev:build"

npm run docker:down > /dev/null 2>&1 || true

echo "Building containers..."
if ! npm run docker:dev:build > /dev/null 2>&1; then
  echo "✗ Build failed"
  exit 1
fi
echo "✓ Build complete"

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

"$(dirname "$0")/smoke-test.sh"

echo ""
echo "✓ Auto-rebuild complete (with smoke test)"
echo "=== Completed successfully ==="
exit 0

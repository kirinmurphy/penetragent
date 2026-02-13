#!/bin/bash

# Auto-rebuild hook for Claude Code
# Runs when Claude finishes responding and determines if Docker containers need rebuilding

set -e

# Change to project root first (needed for relative paths)
cd "$(dirname "$0")/../.."

# Setup logging
LOG_FILE="$(pwd)/.claude/hooks/auto-rebuild.log"
exec > >(tee -a "$LOG_FILE") 2>&1
echo ""
echo "=== Hook triggered at $(date) ==="

# Check if Docker is running
echo "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
  echo "✗ Docker is not running, skipping rebuild check"
  exit 0
fi
echo "✓ Docker is running"

# Check if containers are running
echo "Checking container status..."
SCANNER_RUNNING=$(docker ps --filter "name=infra-scanner-1" --format "{{.Names}}" 2>/dev/null || true)
CONTROLLER_RUNNING=$(docker ps --filter "name=infra-controller-1" --format "{{.Names}}" 2>/dev/null || true)

if [ -n "$SCANNER_RUNNING" ]; then
  echo "  ✓ Scanner container running"
fi
if [ -n "$CONTROLLER_RUNNING" ]; then
  echo "  ✓ Controller container running"
fi

# If no containers running, skip
if [ -z "$SCANNER_RUNNING" ] && [ -z "$CONTROLLER_RUNNING" ]; then
  echo "✗ No containers running, skipping rebuild"
  exit 0
fi

# Check for uncommitted changes
echo "Checking for uncommitted changes..."
CHANGED_FILES=$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u )

if [ -z "$CHANGED_FILES" ]; then
  echo "✓ No uncommitted changes found"
  exit 0
fi

echo "Found uncommitted changes:"
echo "$CHANGED_FILES" | sed 's/^/  - /'

# Define patterns that require rebuild (pattern:reason)
REBUILD_PATTERNS=(
  # Dependencies & runtime
  "package(-lock)?\.json$:Dependency changes"
  "\.nvmrc$|\.node-version$:Node version changes"

  # Docker & infrastructure
  "^(Dockerfile|docker-compose|infra/):Docker/infrastructure changes"
  "\.dockerignore$:Docker ignore changes"

  # Build configuration
  "tsconfig.*\.json$:TypeScript config changes"
  "\.swcrc$|\.babelrc:Build tool config changes"

  # Shared package (compiled dependency)
  "^shared/src/:Shared package changes"

  # Database & migrations
  "^scanner/src/db/:Database schema changes"

  # Environment & startup
  "\.env:Environment variable changes"
  "^scripts/(startup|init|entrypoint):Startup script changes"
)

# Check if any pattern matches
echo "Checking rebuild patterns..."
REBUILD_REASON=""
for pattern_entry in "${REBUILD_PATTERNS[@]}"; do
  pattern="${pattern_entry%%:*}"
  reason="${pattern_entry##*:}"

  if echo "$CHANGED_FILES" | grep -q -E "$pattern"; then
    REBUILD_REASON="$reason"
    echo "✓ Match found: $reason (pattern: $pattern)"
    break
  fi
done

if [ -z "$REBUILD_REASON" ]; then
  echo "✓ No rebuild needed"
  echo "=== Hook completed successfully ==="
  exit 0
fi

echo ""
echo "🔨 Rebuild required: $REBUILD_REASON"
echo "Running: npm run docker:down && npm run docker:dev:build"

# Stop containers
npm run docker:down > /dev/null 2>&1

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

# Run e2e verification if verify-e2e.sh exists
if [ -f "./scripts/verify-e2e.sh" ]; then
  echo "Running e2e verification..."
  sleep 5
  if ./scripts/verify-e2e.sh; then
    echo "✓ E2E verification passed"
  else
    echo "✗ E2E verification failed"
    exit 1
  fi
fi

echo "✓ Auto-rebuild complete"
echo "=== Hook completed successfully ==="
exit 0

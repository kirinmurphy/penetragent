#!/bin/bash

set -e

SCANNER_URL="http://localhost:8080"
TEST_TARGET_ID="example.com"
TEST_TARGET_URL="https://example.com"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

check_service_health() {
  local max_attempts=30
  local attempt=1

  log_info "Waiting for scanner service to be healthy..."

  while [ $attempt -le $max_attempts ]; do
    if curl -sf "$SCANNER_URL/health" > /dev/null 2>&1; then
      log_success "Scanner service is healthy"
      return 0
    fi
    echo -n "." >&2
    sleep 2
    attempt=$((attempt + 1))
  done

  log_error "Scanner service failed to become healthy after $max_attempts attempts"
  return 1
}

create_test_target() {
  log_info "Creating test target '$TEST_TARGET_ID' -> $TEST_TARGET_URL"

  if response=$(curl -sf -X POST "$SCANNER_URL/targets" \
    -H "Content-Type: application/json" \
    -d "{
      \"id\": \"$TEST_TARGET_ID\",
      \"baseUrl\": \"$TEST_TARGET_URL\",
      \"description\": \"Test target for verification\"
    }" 2>&1); then
    log_success "Target created successfully"
    echo "$response" | jq '.' 2>/dev/null >&2 || echo "$response" >&2
  else
    log_warning "Target might already exist or creation failed"
    echo "$response" >&2
  fi
}

create_scan_job() {
  local scan_type="${1:-headers}"

  log_info "Creating $scan_type scan job for target '$TEST_TARGET_ID'"

  if ! response=$(curl -sf -X POST "$SCANNER_URL/scan" \
    -H "Content-Type: application/json" \
    -d "{
      \"targetId\": \"$TEST_TARGET_ID\",
      \"scanType\": \"$scan_type\",
      \"requestedBy\": \"verify-script\"
    }"); then
    log_error "Failed to create scan job"
    return 1
  fi

  job_id=$(echo "$response" | jq -r '.jobId')

  if [ -z "$job_id" ] || [ "$job_id" = "null" ]; then
    log_error "Invalid response - no jobId found"
    echo "$response" >&2
    return 1
  fi

  log_success "Scan job created: $job_id"
  echo "$job_id"
}

wait_for_job_completion() {
  local job_id="$1"
  local max_attempts=60
  local attempt=1

  log_info "Waiting for job $job_id to complete..."

  while [ $attempt -le $max_attempts ]; do
    if ! response=$(curl -sf "$SCANNER_URL/jobs/$job_id"); then
      log_error "Failed to fetch job status"
      return 1
    fi

    status=$(echo "$response" | jq -r '.status')

    case "$status" in
      "SUCCEEDED")
        log_success "Job completed successfully"
        echo "$response" | jq '.' >&2
        return 0
        ;;
      "FAILED")
        log_error "Job failed"
        echo "$response" | jq '.' >&2
        return 1
        ;;
      "QUEUED"|"RUNNING")
        echo -n "." >&2
        sleep 2
        ;;
      *)
        log_warning "Unknown status: $status"
        echo "$response" | jq '.' >&2
        sleep 2
        ;;
    esac

    attempt=$((attempt + 1))
  done

  log_error "Job did not complete within expected time"
  return 1
}

check_report_files() {
  local job_id="$1"

  log_info "Checking generated report files in container..."

  # Check if report.json exists
  if docker exec infra-scanner-1 test -f "/data/reports/$job_id/report.json"; then
    log_success "Found report.json"

    # Show report summary
    docker exec infra-scanner-1 cat "/data/reports/$job_id/report.json" | jq '{
      jobId,
      targetUrl,
      scanTypes,
      criticalFindings: .criticalFindings | length,
      timestamp
    }' >&2
  else
    log_error "report.json not found"
    return 1
  fi

  # Check if report HTML exists (filename includes target ID and date)
  html_file=$(docker exec infra-scanner-1 sh -c "ls /data/reports/$job_id/report-*.html 2>/dev/null | head -1")
  if [ -n "$html_file" ]; then
    log_success "Found $(basename "$html_file")"

    # Show HTML file size
    size=$(docker exec infra-scanner-1 wc -c < "$html_file")
    log_info "HTML report size: $size bytes"
  else
    log_error "HTML report not found"
    return 1
  fi

  return 0
}

list_jobs() {
  log_info "Fetching recent jobs..."

  if ! response=$(curl -sf "$SCANNER_URL/jobs?limit=5&offset=0"); then
    log_error "Failed to fetch jobs list"
    return 1
  fi

  log_success "Recent jobs:"
  echo "$response" | jq '.jobs[] | {jobId, targetId, scanType, status, createdAt}' >&2
}

run_full_verification() {
  log_info "Starting end-to-end verification..."
  echo "" >&2

  # Step 1: Check health
  check_service_health || return 1
  echo "" >&2

  # Step 2: List existing targets
  log_info "Listing existing targets..."
  curl -sf "$SCANNER_URL/targets" | jq '.targets[] | {id, base_url}' >&2 || log_warning "Failed to list targets"
  echo "" >&2

  # Step 3: Create test target
  create_test_target
  echo "" >&2

  # Step 4: Create headers scan
  log_info "=== Testing Headers Scan ==="
  if ! job_id=$(create_scan_job "headers"); then
    return 1
  fi
  echo "" >&2

  # Step 5: Wait for completion
  wait_for_job_completion "$job_id" || return 1
  echo "" >&2

  # Step 6: Check report files
  check_report_files "$job_id" || return 1
  echo "" >&2

  # Step 7: Test crawl scan
  log_info "=== Testing Crawl Scan ==="
  if ! job_id=$(create_scan_job "crawl"); then
    return 1
  fi
  echo "" >&2

  wait_for_job_completion "$job_id" || return 1
  echo "" >&2

  check_report_files "$job_id" || return 1
  echo "" >&2

  # Step 8: Test combined scan
  log_info "=== Testing Combined Scan (all) ==="
  if ! job_id=$(create_scan_job "all"); then
    return 1
  fi
  echo "" >&2

  wait_for_job_completion "$job_id" || return 1
  echo "" >&2

  check_report_files "$job_id" || return 1
  echo "" >&2

  # Step 9: List recent jobs
  list_jobs
  echo "" >&2

  log_success "==================================="
  log_success "All verification tests passed!"
  log_success "==================================="
}

# Main execution
if ! command -v jq &> /dev/null; then
  log_error "jq is required but not installed. Please install jq first."
  exit 1
fi

run_full_verification

#!/bin/bash

# Smoke tests the scanner service
# Called by rebuild.sh or can be run directly

set -e

SCANNER_URL="http://127.0.0.1:8080"
SMOKE_TARGET="https://httpbin.org"
SMOKE_POLL_MAX=120

echo ""
echo "--- Scanner smoke test ---"

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

HAS_SUMMARY=$(echo "$JOB_JSON" | grep -c '"summaryJson"' || true)
HAS_PAGES=$(echo "$JOB_JSON" | grep -c '"pagesScanned"' || true)

if [ "$HAS_SUMMARY" -eq 0 ] || [ "$HAS_PAGES" -eq 0 ]; then
  echo "✗ Job response missing expected fields (summaryJson, pagesScanned)"
  echo "  Response: $JOB_JSON"
  exit 1
fi
echo "✓ Job response has summaryJson with pagesScanned"

HTML_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${SCANNER_URL}/reports/${JOB_ID}/html" 2>/dev/null || echo "000")
if [ "$HTML_STATUS" = "200" ]; then
  echo "✓ HTML report accessible (200)"
else
  echo "✗ HTML report returned status ${HTML_STATUS}"
  exit 1
fi

curl -sf -X DELETE "${SCANNER_URL}/jobs/${JOB_ID}" > /dev/null 2>&1 || true
echo "✓ Smoke test job cleaned up"

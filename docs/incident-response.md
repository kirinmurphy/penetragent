# Incident Response Runbook

## What This Is (Plain English)

This document is an emergency playbook for your scanner.

If you suspect the scanner is behaving unsafely, this runbook tells you how to:

- stop risky outbound scanning immediately,
- confirm the stop is active,
- and safely turn scanning back on after the issue is resolved.

Think of this like an emergency brake:

- `OUTBOUND_EGRESS_DISABLED=true` means "do not let the scanner make outbound network requests."
- `INTERNAL_ASSESSMENT_DISABLED=true` means "force safer external-only behavior."

The `/health` check is your dashboard light. It tells you whether the emergency settings are actually active.

Use this runbook when scanner behavior must be restricted immediately.

## Emergency Controls

- `OUTBOUND_EGRESS_DISABLED=true`
  Stops all outbound scan traffic immediately.
- `INTERNAL_ASSESSMENT_DISABLED=true`
  Forces internal-assessment requests to behave as `external-safe`.

## 1. Immediate Containment

Set both emergency flags:

```bash
OUTBOUND_EGRESS_DISABLED=true
INTERNAL_ASSESSMENT_DISABLED=true
```

If using Docker, update `.env` and restart:

```bash
npm run docker:down
npm run docker:dev
```

If running scanner directly, export and restart process:

```bash
export OUTBOUND_EGRESS_DISABLED=true
export INTERNAL_ASSESSMENT_DISABLED=true
cd scanner && npx tsx src/index.ts
```

## 2. Verify Runtime State

Check scanner health endpoint:

```bash
curl localhost:8080/health
```

Expected fields:

- `policy.outboundEgressDisabled` is `true`
- `policy.internalAssessmentDisabled` is `true`
- `policy.effectiveMode` is `external-safe`

## 3. Confirm Enforcement

Start a scan:

```bash
curl -X POST localhost:8080/scan \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","requestedBy":"incident-check"}'
```

Then check status:

```bash
curl localhost:8080/jobs/<jobId>
```

Expected result:

- Job transitions to `FAILED`
- `errorCode` is `SCAN_EXECUTION_FAILED`
- `errorMessage` mentions egress is disabled

## 4. Collect Evidence

Capture:

- `/health` response
- job status response
- scanner logs with `type: "outbound_audit"` deny events

## 5. Rollback Procedure

When incident is resolved:

```bash
OUTBOUND_EGRESS_DISABLED=false
INTERNAL_ASSESSMENT_DISABLED=false
```

Restart scanner/controller and re-check:

```bash
curl localhost:8080/health
```

Expected fields:

- `policy.outboundEgressDisabled` is `false`
- `policy.internalAssessmentDisabled` is `false`

## 6. Post-Incident Checklist

- Record incident timeline and root cause.
- Confirm scan scope and policy config are still correct.
- Keep `OUTBOUND_AUDIT_LOG_LEVEL=deny` in normal operations.
- Temporarily use `OUTBOUND_AUDIT_LOG_LEVEL=all` only for deep troubleshooting.

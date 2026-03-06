# Internal Assessment Checklist

Use this checklist before running internal-assessment scans against a client environment.

## 1. Authorization and Scope

- [ ] Written approval exists (SOW, MSA, or signed email from authorized contact).
- [ ] In-scope environments are listed (prod, staging, dev).
- [ ] In-scope targets are listed (domains, subdomains, IP ranges, ports).
- [ ] Out-of-scope assets are listed.
- [ ] Time window is agreed with client.

## 2. Scan Mode and Safety

- [ ] `SCAN_POLICY_MODE=internal-assessment` is intentionally enabled.
- [ ] `INTERNAL_ALLOWED_HOST_PATTERNS` is set to only approved hostnames/patterns.
- [ ] `INTERNAL_ALLOWED_PORTS` is set to only approved ports.
- [ ] `INTERNAL_ALLOW_PRIVATE_IPS` is enabled only when private address scanning is authorized.
- [ ] `INTERNAL_ASSESSMENT_DISABLED=false` is confirmed before internal scans.
- [ ] `OUTBOUND_EGRESS_DISABLED=false` is confirmed before any active scan.

## 3. Runtime Isolation

- [ ] Scanner runs in a dedicated container/VM/network segment.
- [ ] Scanner cannot reach unrelated internal services.
- [ ] Cloud metadata endpoints are blocked unless explicitly in scope.
- [ ] Scanner credentials are scoped and non-privileged.

## 4. Operational Guardrails

- [ ] Request timeouts, redirect limits, and crawl limits are enabled.
- [ ] One-scan-at-a-time policy is enforced for this deployment.
- [ ] Emergency stop procedure is documented.
- [ ] Emergency kill-switch process is documented (`INTERNAL_ASSESSMENT_DISABLED=true`).
- [ ] Full outbound stop procedure is documented (`OUTBOUND_EGRESS_DISABLED=true`).
- [ ] Outbound audit log level is set (`OUTBOUND_AUDIT_LOG_LEVEL=deny` for normal ops, `all` for deep troubleshooting).
- [ ] Scan operator and change log are recorded.

## 5. Data Handling

- [ ] Reports are stored in approved location with restricted access.
- [ ] Retention period is defined.
- [ ] Sensitive findings are not shared over insecure channels.
- [ ] Deletion process is defined when engagement ends.

## 6. Post-Scan Review

- [ ] Findings are triaged by severity and exploitability.
- [ ] Remediation owners and deadlines are assigned.
- [ ] Critical findings are re-tested after fixes.
- [ ] Client sign-off is captured for closure.

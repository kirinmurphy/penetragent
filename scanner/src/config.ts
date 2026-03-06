import type { ScannerConfig } from "@penetragent/shared";

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function parsePortCsv(value: string | undefined): number[] {
  const raw = parseCsv(value);
  const ports = raw
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 65535);
  return ports.length > 0 ? ports : [80, 443];
}

export function loadConfig(): ScannerConfig {
  const scanPolicyMode = process.env.SCAN_POLICY_MODE === "internal-assessment"
    ? "internal-assessment"
    : "external-safe";
  const outboundAuditLogLevel = process.env.OUTBOUND_AUDIT_LOG_LEVEL === "all"
    ? "all"
    : "deny";

  return {
    port: parseInt(process.env.SCANNER_PORT || "8080", 10),
    host: process.env.SCANNER_HOST || "0.0.0.0",
    dbPath: process.env.DB_PATH || "scanner.sqlite",
    reportsDir: process.env.REPORTS_DIR || "reports",
    workerPollIntervalMs: parseInt(
      process.env.WORKER_POLL_INTERVAL_MS || "2000",
      10,
    ),
    heartbeatIntervalMs: parseInt(
      process.env.HEARTBEAT_INTERVAL_MS || "5000",
      10,
    ),
    staleHeartbeatThresholdMs: parseInt(
      process.env.STALE_HEARTBEAT_THRESHOLD_MS || "30000",
      10,
    ),
    scanPolicyMode,
    internalAssessmentDisabled:
      process.env.INTERNAL_ASSESSMENT_DISABLED === "true",
    outboundEgressDisabled: process.env.OUTBOUND_EGRESS_DISABLED === "true",
    outboundAuditLogLevel,
    internalAllowedHostPatterns: parseCsv(process.env.INTERNAL_ALLOWED_HOST_PATTERNS),
    internalAllowedPorts: parsePortCsv(process.env.INTERNAL_ALLOWED_PORTS),
    internalAllowPrivateIps: process.env.INTERNAL_ALLOW_PRIVATE_IPS === "true",
  };
}

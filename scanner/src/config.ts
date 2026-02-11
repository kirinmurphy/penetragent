import type { ScannerConfig } from "@penetragent/shared";

export function loadConfig(): ScannerConfig {
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
  };
}

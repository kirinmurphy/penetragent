export type ScanPolicyMode = "external-safe" | "internal-assessment";
export type OutboundAuditLogLevel = "deny" | "all";

export interface ScannerConfig {
  port: number;
  host: string;
  dbPath: string;
  reportsDir: string;
  workerPollIntervalMs: number;
  heartbeatIntervalMs: number;
  staleHeartbeatThresholdMs: number;
  scanPolicyMode: ScanPolicyMode;
  internalAssessmentDisabled: boolean;
  outboundEgressDisabled: boolean;
  outboundAuditLogLevel: OutboundAuditLogLevel;
  internalAllowedHostPatterns: string[];
  internalAllowedPorts: number[];
  internalAllowPrivateIps: boolean;
}

export interface ControllerConfig {
  telegramBotToken: string;
  telegramAllowedUserId: string;
  scannerBaseUrl: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
}

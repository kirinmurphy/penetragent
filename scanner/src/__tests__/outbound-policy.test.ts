import { describe, expect, it, vi, beforeEach } from "vitest";
import { createOutboundPolicy } from "../security/outbound-policy.js";

vi.mock("../security/verify-public-only.js", () => ({
  verifyPublicOnly: vi.fn(),
  DnsError: class TestDnsError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

import { verifyPublicOnly } from "../security/verify-public-only.js";

const mockVerifyPublicOnly = vi.mocked(verifyPublicOnly);
const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

describe("outbound policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyPublicOnly.mockResolvedValue(["93.184.216.34"]);
    logSpy.mockClear();
  });

  it("allows only target hostname in external-safe mode", async () => {
    const policy = createOutboundPolicy({
      scannerConfig: {
        port: 8080,
        host: "0.0.0.0",
        dbPath: "scanner.sqlite",
        reportsDir: "reports",
        workerPollIntervalMs: 2000,
        heartbeatIntervalMs: 5000,
        staleHeartbeatThresholdMs: 30000,
        scanPolicyMode: "external-safe",
        internalAssessmentDisabled: false,
        outboundEgressDisabled: false,
        outboundAuditLogLevel: "deny",
        internalAllowedHostPatterns: [],
        internalAllowedPorts: [80, 443],
        internalAllowPrivateIps: false,
      },
      targetUrl: "https://example.com",
    });

    await expect(policy.verifyUrl(new URL("https://example.com/test"))).resolves.toBeUndefined();
    await expect(policy.verifyUrl(new URL("https://evil.example.net"))).rejects.toThrow(
      /Disallowed outbound host/,
    );
  });

  it("enforces allowlisted host patterns in internal-assessment mode", async () => {
    const policy = createOutboundPolicy({
      scannerConfig: {
        port: 8080,
        host: "0.0.0.0",
        dbPath: "scanner.sqlite",
        reportsDir: "reports",
        workerPollIntervalMs: 2000,
        heartbeatIntervalMs: 5000,
        staleHeartbeatThresholdMs: 30000,
        scanPolicyMode: "internal-assessment",
        internalAssessmentDisabled: false,
        outboundEgressDisabled: false,
        outboundAuditLogLevel: "deny",
        internalAllowedHostPatterns: ["*.example.net"],
        internalAllowedPorts: [80, 443],
        internalAllowPrivateIps: false,
      },
      targetUrl: "https://example.com",
    });

    await expect(policy.verifyUrl(new URL("https://api.example.net"))).resolves.toBeUndefined();
    await expect(policy.verifyUrl(new URL("https://api.evil.net"))).rejects.toThrow(
      /outside internal assessment allowlist/,
    );
  });

  it("enforces allowlisted ports in internal-assessment mode", async () => {
    const policy = createOutboundPolicy({
      scannerConfig: {
        port: 8080,
        host: "0.0.0.0",
        dbPath: "scanner.sqlite",
        reportsDir: "reports",
        workerPollIntervalMs: 2000,
        heartbeatIntervalMs: 5000,
        staleHeartbeatThresholdMs: 30000,
        scanPolicyMode: "internal-assessment",
        internalAssessmentDisabled: false,
        outboundEgressDisabled: false,
        outboundAuditLogLevel: "deny",
        internalAllowedHostPatterns: [],
        internalAllowedPorts: [443],
        internalAllowPrivateIps: false,
      },
      targetUrl: "https://example.com",
    });

    await expect(policy.verifyUrl(new URL("https://example.com"))).resolves.toBeUndefined();
    await expect(policy.verifyUrl(new URL("https://example.com:8443"))).rejects.toThrow(
      /outside internal assessment allowlist/,
    );
  });

  it("skips public-ip verification when internal private ip scanning is enabled", async () => {
    const policy = createOutboundPolicy({
      scannerConfig: {
        port: 8080,
        host: "0.0.0.0",
        dbPath: "scanner.sqlite",
        reportsDir: "reports",
        workerPollIntervalMs: 2000,
        heartbeatIntervalMs: 5000,
        staleHeartbeatThresholdMs: 30000,
        scanPolicyMode: "internal-assessment",
        internalAssessmentDisabled: false,
        outboundEgressDisabled: false,
        outboundAuditLogLevel: "deny",
        internalAllowedHostPatterns: [],
        internalAllowedPorts: [80, 443],
        internalAllowPrivateIps: true,
      },
      targetUrl: "https://example.com",
    });

    await policy.verifyUrl(new URL("https://example.com"));
    expect(mockVerifyPublicOnly).not.toHaveBeenCalled();
  });

  it("kill-switch downgrades internal-assessment to external-safe", async () => {
    const policy = createOutboundPolicy({
      scannerConfig: {
        port: 8080,
        host: "0.0.0.0",
        dbPath: "scanner.sqlite",
        reportsDir: "reports",
        workerPollIntervalMs: 2000,
        heartbeatIntervalMs: 5000,
        staleHeartbeatThresholdMs: 30000,
        scanPolicyMode: "internal-assessment",
        internalAssessmentDisabled: true,
        outboundEgressDisabled: false,
        outboundAuditLogLevel: "deny",
        internalAllowedHostPatterns: ["*.example.net"],
        internalAllowedPorts: [80, 443],
        internalAllowPrivateIps: true,
      },
      targetUrl: "https://example.com",
      jobId: "job-123",
    });

    expect(policy.mode).toBe("external-safe");
    await expect(policy.verifyUrl(new URL("https://api.example.net"))).rejects.toThrow(
      /Disallowed outbound host/,
    );
  });

  it("emits structured outbound audit logs", async () => {
    const policy = createOutboundPolicy({
      scannerConfig: {
        port: 8080,
        host: "0.0.0.0",
        dbPath: "scanner.sqlite",
        reportsDir: "reports",
        workerPollIntervalMs: 2000,
        heartbeatIntervalMs: 5000,
        staleHeartbeatThresholdMs: 30000,
        scanPolicyMode: "external-safe",
        internalAssessmentDisabled: false,
        outboundEgressDisabled: false,
        outboundAuditLogLevel: "all",
        internalAllowedHostPatterns: [],
        internalAllowedPorts: [80, 443],
        internalAllowPrivateIps: false,
      },
      targetUrl: "https://example.com",
      jobId: "job-456",
    });

    await policy.verifyUrl(new URL("https://example.com/path"));
    expect(logSpy).toHaveBeenCalled();
    const logged = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(logged.type).toBe("outbound_audit");
    expect(logged.jobId).toBe("job-456");
    expect(logged.host).toBe("example.com");
    expect(logged.port).toBe(443);
    expect(logged.allowed).toBe(true);
  });

  it("blocks all outbound traffic when egress kill-switch is enabled", async () => {
    const policy = createOutboundPolicy({
      scannerConfig: {
        port: 8080,
        host: "0.0.0.0",
        dbPath: "scanner.sqlite",
        reportsDir: "reports",
        workerPollIntervalMs: 2000,
        heartbeatIntervalMs: 5000,
        staleHeartbeatThresholdMs: 30000,
        scanPolicyMode: "external-safe",
        internalAssessmentDisabled: false,
        outboundEgressDisabled: true,
        outboundAuditLogLevel: "deny",
        internalAllowedHostPatterns: [],
        internalAllowedPorts: [80, 443],
        internalAllowPrivateIps: false,
      },
      targetUrl: "https://example.com",
      jobId: "job-egress-off",
    });

    await expect(policy.verifyUrl(new URL("https://example.com"))).rejects.toThrow(
      /egress is disabled/,
    );
    const logged = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(logged.allowed).toBe(false);
    expect(logged.reason).toContain("egress is disabled");
  });
});

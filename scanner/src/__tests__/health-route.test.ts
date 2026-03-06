import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import type { ScannerConfig } from "@penetragent/shared";
import { healthRoutes } from "../routes/health.js";

function buildConfig(overrides: Partial<ScannerConfig> = {}): ScannerConfig {
  return {
    port: 8080,
    host: "0.0.0.0",
    dbPath: ":memory:",
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
    ...overrides,
  };
}

describe("/health policy smoke test", () => {
  it("returns required policy fields", async () => {
    const app = Fastify();
    app.decorate("config", buildConfig());
    await app.register(healthRoutes);
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      ok: boolean;
      policy: Record<string, unknown>;
    };
    expect(body.ok).toBe(true);
    expect(body.policy).toBeDefined();
    expect(body.policy).toHaveProperty("requestedMode");
    expect(body.policy).toHaveProperty("effectiveMode");
    expect(body.policy).toHaveProperty("internalAssessmentDisabled");
    expect(body.policy).toHaveProperty("outboundEgressDisabled");

    await app.close();
  });

  it("downgrades effective mode when internal assessment is disabled", async () => {
    const app = Fastify();
    app.decorate(
      "config",
      buildConfig({
        scanPolicyMode: "internal-assessment",
        internalAssessmentDisabled: true,
      }),
    );
    await app.register(healthRoutes);
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health" });
    const body = res.json() as {
      policy: { requestedMode: string; effectiveMode: string };
    };
    expect(body.policy.requestedMode).toBe("internal-assessment");
    expect(body.policy.effectiveMode).toBe("external-safe");

    await app.close();
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { migrate } from "../../db/migrate.js";
import { healthRoutes } from "../../routes/health.js";
import { scanRoutes } from "../../routes/scan.js";
import { jobsRoutes } from "../../routes/jobs.js";
import { startWorker } from "../../worker/worker.js";
import type { ScannerConfig } from "@penetragent/shared";

// Mock DNS to avoid real network calls
vi.mock("node:dns/promises", () => ({
  default: {
    resolve4: vi.fn().mockResolvedValue(["93.184.216.34"]),
    resolve6: vi.fn().mockRejectedValue(new Error("ENODATA")),
  },
}));

// Mock fetch for headers profile
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue(
    new Response("", {
      status: 200,
      headers: {
        "strict-transport-security":
          "max-age=31536000; includeSubDomains",
        "content-security-policy": "default-src 'self'",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "no-referrer",
      },
    }),
  ),
);

const testConfig: ScannerConfig = {
  port: 0,
  host: "127.0.0.1",
  dbPath: ":memory:",
  reportsDir: "/tmp/penetragent-test-reports",
  workerPollIntervalMs: 100,
  heartbeatIntervalMs: 5000,
  staleHeartbeatThresholdMs: 30000,
  scanPolicyMode: "external-safe",
  internalAllowedHostPatterns: [],
  internalAllowedPorts: [80, 443],
  internalAllowPrivateIps: false,
  internalAssessmentDisabled: false,
  outboundEgressDisabled: false,
  outboundAuditLogLevel: "deny",
};

function seedTestTargets(db: Database.Database): void {
  db.prepare(
    "INSERT INTO targets (id, base_url, description) VALUES (?, ?, ?)",
  ).run("staging", "https://staging.example.com", "Test staging");
  db.prepare(
    "INSERT INTO targets (id, base_url, description) VALUES (?, ?, ?)",
  ).run("prod", "https://prod.example.com", "Test prod");
}

function buildApp(
  configOverrides: Partial<ScannerConfig> = {},
): { app: FastifyInstance; db: Database.Database } {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedTestTargets(db);

  const app = Fastify();
  app.decorate("db", db);
  app.decorate("config", { ...testConfig, ...configOverrides });

  app.register(healthRoutes);
  app.register(scanRoutes);
  app.register(jobsRoutes);

  return { app, db };
}

describe("Scanner API integration", () => {
  let app: FastifyInstance;
  let db: Database.Database;

  beforeAll(async () => {
    const built = buildApp();
    app = built.app;
    db = built.db;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.prepare("DELETE FROM jobs").run();
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      policy: {
        requestedMode: "external-safe",
        effectiveMode: "external-safe",
        internalAssessmentDisabled: false,
        outboundEgressDisabled: false,
      },
    });
  });

  it("GET /health reports kill-switch downgraded effective mode", async () => {
    const { app: localApp } = buildApp({
      scanPolicyMode: "internal-assessment",
      internalAssessmentDisabled: true,
    });
    await localApp.ready();

    const res = await localApp.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      policy: {
        requestedMode: "internal-assessment",
        effectiveMode: "external-safe",
        internalAssessmentDisabled: true,
        outboundEgressDisabled: false,
      },
    });

    await localApp.close();
  });

  it("POST /scan with invalid target returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "nonexistent",
        scanType: "http",
        requestedBy: "test",
      },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("TARGET_NOT_FOUND");
  });

  it("POST /scan with invalid body returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: { targetId: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("VALIDATION_ERROR");
  });

  it("POST /scan creates a QUEUED job", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "staging",
        scanType: "http",
        requestedBy: "test",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.jobId).toBeDefined();
    expect(body.status).toBe("QUEUED");
  });

  it("POST /scan without scanType defaults to all", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "staging",
        requestedBy: "test",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.scanType).toBe("all");
  });

  it("POST /scan with invalid scanType returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "staging",
        scanType: "bogus",
        requestedBy: "test",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("INVALID_SCAN_TYPE");
  });

  it("GET /jobs/:jobId returns the job", async () => {
    const scanRes = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "staging",
        scanType: "http",
        requestedBy: "test",
      },
    });
    const { jobId } = scanRes.json();

    const res = await app.inject({
      method: "GET",
      url: `/jobs/${jobId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().jobId).toBe(jobId);
  });

  it("GET /jobs/:jobId returns 404 for missing job", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/jobs/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("JOB_NOT_FOUND");
  });

  it("GET /jobs returns paginated list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/jobs?limit=5&offset=0",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.jobs).toBeDefined();
    expect(body.total).toBeGreaterThanOrEqual(0);
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(0);
  });

  it("rate limits when a job is RUNNING", async () => {
    // Manually set a job to RUNNING
    const jobId = "rate-limit-test-" + Date.now();
    db.prepare(
      "INSERT INTO jobs (id, target_id, scan_type, status, requested_by) VALUES (?, ?, ?, 'RUNNING', ?)",
    ).run(jobId, "staging", "headers", "test");

    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "staging",
        scanType: "http",
        requestedBy: "test",
      },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("RATE_LIMITED");
    expect(res.json().runningJobId).toBe(jobId);

    // Clean up
    db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
  });

  it("rate limits when a job is QUEUED", async () => {
    const jobId = "rate-limit-queued-test-" + Date.now();
    db.prepare(
      "INSERT INTO jobs (id, target_id, scan_type, status, requested_by) VALUES (?, ?, ?, 'QUEUED', ?)",
    ).run(jobId, "staging", "http", "test");

    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "staging",
        scanType: "http",
        requestedBy: "test",
      },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("RATE_LIMITED");
    expect(res.json().runningJobId).toBe(jobId);

    db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
  });
});

describe("Full scan flow", () => {
  it("POST /scan → worker picks up → SUCCEEDED", async () => {
    const { app, db } = buildApp();
    await app.ready();

    // Start worker
    startWorker(db, { ...testConfig, workerPollIntervalMs: 50 });

    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "staging",
        scanType: "http",
        requestedBy: "test",
      },
    });
    expect(res.statusCode).toBe(201);
    const { jobId } = res.json();

    // Poll until terminal
    let status = "QUEUED";
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const jobRes = await app.inject({
        method: "GET",
        url: `/jobs/${jobId}`,
      });
      status = jobRes.json().status;
      if (status !== "QUEUED" && status !== "RUNNING") break;
    }

    expect(status).toBe("SUCCEEDED");

    await app.close();
  });

  it("fails fast when outbound egress kill-switch is enabled", async () => {
    const { app, db } = buildApp({ outboundEgressDisabled: true });
    await app.ready();

    startWorker(db, { ...testConfig, outboundEgressDisabled: true, workerPollIntervalMs: 50 });

    const res = await app.inject({
      method: "POST",
      url: "/scan",
      payload: {
        targetId: "staging",
        scanType: "http",
        requestedBy: "test",
      },
    });
    expect(res.statusCode).toBe(201);
    const { jobId } = res.json();

    let status = "QUEUED";
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const jobRes = await app.inject({
        method: "GET",
        url: `/jobs/${jobId}`,
      });
      const job = jobRes.json();
      status = job.status;
      errorCode = job.errorCode;
      errorMessage = job.errorMessage;
      if (status !== "QUEUED" && status !== "RUNNING") break;
    }

    expect(status).toBe("FAILED");
    expect(errorCode).toBe("SCAN_EXECUTION_FAILED");
    expect(errorMessage).toContain("egress is disabled");

    await app.close();
  });
});

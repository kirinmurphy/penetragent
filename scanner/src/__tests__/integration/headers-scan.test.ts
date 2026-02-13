import { describe, it, expect, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { runHeadersScan } from "../../scanTypes/headers.js";
import type { HeadersReport, HeadersSummary } from "../../scanTypes/headers.js";

// --- Test server helpers ---

type HeaderMap = Record<string, string>;

async function startServer(
  headers: HeaderMap,
  statusCode = 200,
): Promise<{ url: string; server: FastifyInstance }> {
  const server = Fastify();
  server.get("/", async (_req, reply) => {
    for (const [key, value] of Object.entries(headers)) {
      reply.header(key, value);
    }
    return reply.status(statusCode).send("ok");
  });
  const address = await server.listen({ port: 0, host: "127.0.0.1" });
  return { url: address, server };
}

async function startRedirectServer(
  hops: { status: number; headers?: HeaderMap }[],
  finalHeaders: HeaderMap,
): Promise<{ url: string; servers: FastifyInstance[] }> {
  const servers: FastifyInstance[] = [];

  const finalServer = Fastify();
  finalServer.get("/", async (_req, reply) => {
    for (const [key, value] of Object.entries(finalHeaders)) {
      reply.header(key, value);
    }
    return reply.status(200).send("final");
  });
  const finalAddress = await finalServer.listen({
    port: 0,
    host: "127.0.0.1",
  });
  servers.push(finalServer);

  let nextUrl = finalAddress;
  const chainServers: FastifyInstance[] = [];

  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = hops[i];
    const target = nextUrl;
    const hopServer = Fastify();
    hopServer.get("/", async (_req, reply) => {
      if (hop.headers) {
        for (const [key, value] of Object.entries(hop.headers)) {
          reply.header(key, value);
        }
      }
      reply.header("location", target);
      return reply.status(hop.status).send("");
    });
    const hopAddress = await hopServer.listen({
      port: 0,
      host: "127.0.0.1",
    });
    chainServers.unshift(hopServer);
    nextUrl = hopAddress;
  }

  servers.push(...chainServers);
  return { url: nextUrl, servers };
}

// --- Test setup ---

let reportsDir: string;
let serversToClose: FastifyInstance[] = [];

function tmpReportsDir(): string {
  reportsDir = path.join(os.tmpdir(), `penetragent-test-${crypto.randomUUID()}`);
  fs.mkdirSync(reportsDir, { recursive: true });
  return reportsDir;
}

afterEach(async () => {
  for (const server of serversToClose) {
    await server.close();
  }
  serversToClose = [];
  if (reportsDir && fs.existsSync(reportsDir)) {
    fs.rmSync(reportsDir, { recursive: true });
  }
});

async function scan(
  url: string,
): Promise<{ report: HeadersReport; summary: HeadersSummary }> {
  const dir = tmpReportsDir();
  const jobId = crypto.randomUUID();
  return runHeadersScan(url, dir, jobId);
}

function findGrade(
  report: HeadersReport,
  headerName: string,
): HeadersReport["headers"][number] {
  return report.headers.find((h) => h.header === headerName)!;
}

// =============================================================
// STRICT-TRANSPORT-SECURITY
// =============================================================

describe("HSTS grading (end-to-end)", () => {
  it("MISSING — header not present", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Strict-Transport-Security");
    expect(grade.grade).toBe("missing");
    expect(grade.value).toBeNull();
  });

  it("WEAK — max-age too short", async () => {
    const { url, server } = await startServer({
      "strict-transport-security": "max-age=3600",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Strict-Transport-Security");
    expect(grade.grade).toBe("weak");
    expect(grade.reason).toContain("less than 1 year");
  });

  it("WEAK — good max-age but no includeSubDomains", async () => {
    const { url, server } = await startServer({
      "strict-transport-security": "max-age=31536000",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Strict-Transport-Security");
    expect(grade.grade).toBe("weak");
    expect(grade.reason).toContain("includeSubDomains");
  });

  it("GOOD — max-age >= 1 year with includeSubDomains", async () => {
    const { url, server } = await startServer({
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Strict-Transport-Security");
    expect(grade.grade).toBe("good");
  });

  it("GOOD — longer max-age with includeSubDomains and preload", async () => {
    const { url, server } = await startServer({
      "strict-transport-security":
        "max-age=63072000; includeSubDomains; preload",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Strict-Transport-Security");
    expect(grade.grade).toBe("good");
  });
});

// =============================================================
// CONTENT-SECURITY-POLICY
// =============================================================

describe("CSP grading (end-to-end)", () => {
  it("MISSING — header not present", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Content-Security-Policy");
    expect(grade.grade).toBe("missing");
  });

  it("WEAK — contains unsafe-inline", async () => {
    const { url, server } = await startServer({
      "content-security-policy": "default-src 'self' 'unsafe-inline'",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Content-Security-Policy");
    expect(grade.grade).toBe("weak");
    expect(grade.reason).toContain("unsafe-inline");
    expect(grade.reason).not.toContain("unsafe-eval");
  });

  it("WEAK — contains unsafe-eval", async () => {
    const { url, server } = await startServer({
      "content-security-policy": "default-src 'self' 'unsafe-eval'",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Content-Security-Policy");
    expect(grade.grade).toBe("weak");
    expect(grade.reason).toContain("unsafe-eval");
    expect(grade.reason).not.toContain("unsafe-inline");
  });

  it("WEAK — contains both unsafe-inline and unsafe-eval", async () => {
    const { url, server } = await startServer({
      "content-security-policy":
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Content-Security-Policy");
    expect(grade.grade).toBe("weak");
    expect(grade.reason).toContain("unsafe-inline");
    expect(grade.reason).toContain("unsafe-eval");
  });

  it("GOOD — safe policy", async () => {
    const { url, server } = await startServer({
      "content-security-policy": "default-src 'self'; img-src https:",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Content-Security-Policy");
    expect(grade.grade).toBe("good");
  });
});

// =============================================================
// X-CONTENT-TYPE-OPTIONS
// =============================================================

describe("X-Content-Type-Options grading (end-to-end)", () => {
  it("MISSING — header not present", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "X-Content-Type-Options");
    expect(grade.grade).toBe("missing");
  });

  it("WEAK — unexpected value", async () => {
    const { url, server } = await startServer({
      "x-content-type-options": "nofollow",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "X-Content-Type-Options");
    expect(grade.grade).toBe("weak");
    expect(grade.reason).toContain("nofollow");
  });

  it("GOOD — nosniff", async () => {
    const { url, server } = await startServer({
      "x-content-type-options": "nosniff",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "X-Content-Type-Options");
    expect(grade.grade).toBe("good");
  });
});

// =============================================================
// X-FRAME-OPTIONS
// =============================================================

describe("X-Frame-Options grading (end-to-end)", () => {
  it("MISSING — header not present", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "X-Frame-Options");
    expect(grade.grade).toBe("missing");
  });

  it("GOOD — DENY", async () => {
    const { url, server } = await startServer({
      "x-frame-options": "DENY",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "X-Frame-Options");
    expect(grade.grade).toBe("good");
  });

  it("GOOD — SAMEORIGIN", async () => {
    const { url, server } = await startServer({
      "x-frame-options": "SAMEORIGIN",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "X-Frame-Options");
    expect(grade.grade).toBe("good");
  });

  it("WEAK — ALLOW-FROM", async () => {
    const { url, server } = await startServer({
      "x-frame-options": "ALLOW-FROM https://example.com",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "X-Frame-Options");
    expect(grade.grade).toBe("weak");
  });
});

// =============================================================
// REFERRER-POLICY
// =============================================================

describe("Referrer-Policy grading (end-to-end)", () => {
  it("MISSING — header not present", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Referrer-Policy");
    expect(grade.grade).toBe("missing");
  });

  it("WEAK — unsafe-url", async () => {
    const { url, server } = await startServer({
      "referrer-policy": "unsafe-url",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Referrer-Policy");
    expect(grade.grade).toBe("weak");
    expect(grade.reason).toContain("unsafe-url");
  });

  it("GOOD — no-referrer", async () => {
    const { url, server } = await startServer({
      "referrer-policy": "no-referrer",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Referrer-Policy");
    expect(grade.grade).toBe("good");
  });

  it("GOOD — strict-origin-when-cross-origin", async () => {
    const { url, server } = await startServer({
      "referrer-policy": "strict-origin-when-cross-origin",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Referrer-Policy");
    expect(grade.grade).toBe("good");
  });
});

// =============================================================
// PERMISSIONS-POLICY
// =============================================================

describe("Permissions-Policy grading (end-to-end)", () => {
  it("MISSING — header not present", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Permissions-Policy");
    expect(grade.grade).toBe("missing");
  });

  it("GOOD — present", async () => {
    const { url, server } = await startServer({
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const grade = findGrade(report, "Permissions-Policy");
    expect(grade.grade).toBe("good");
  });
});

// =============================================================
// INFO LEAKAGE
// =============================================================

describe("Info leakage detection (end-to-end)", () => {
  it("detects Server header", async () => {
    const { url, server } = await startServer({
      server: "Apache/2.4.51 (Ubuntu)",
    });
    serversToClose.push(server);

    const { report, summary } = await scan(url);
    expect(report.infoLeakage).toContainEqual({
      header: "Server",
      value: "Apache/2.4.51 (Ubuntu)",
    });
    expect(summary.infoLeakage).toBe(1);
  });

  it("detects X-Powered-By header", async () => {
    const { url, server } = await startServer({
      "x-powered-by": "Express",
    });
    serversToClose.push(server);

    const { report, summary } = await scan(url);
    expect(report.infoLeakage).toContainEqual({
      header: "X-Powered-By",
      value: "Express",
    });
    expect(summary.infoLeakage).toBe(1);
  });

  it("detects both Server and X-Powered-By", async () => {
    const { url, server } = await startServer({
      server: "nginx/1.24.0",
      "x-powered-by": "PHP/8.2.1",
    });
    serversToClose.push(server);

    const { report, summary } = await scan(url);
    expect(report.infoLeakage).toHaveLength(2);
    expect(summary.infoLeakage).toBe(2);
  });

  it("reports no leakage when headers absent", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { report } = await scan(url);
    // Fastify adds its own server header, so filter for known leaky ones
    const poweredBy = report.infoLeakage.find(
      (l) => l.header === "X-Powered-By",
    );
    expect(poweredBy).toBeUndefined();
  });
});

// =============================================================
// REDIRECT CHAINS
// =============================================================

describe("Redirect chain handling (end-to-end)", () => {
  it("records a single redirect", async () => {
    const { url, servers } = await startRedirectServer(
      [{ status: 301 }],
      { "x-content-type-options": "nosniff" },
    );
    serversToClose.push(...servers);

    const { report } = await scan(url);
    expect(report.redirectChain).toHaveLength(2);
    expect(report.redirectChain[0]).toBe(url);
    expect(report.finalUrl).not.toBe(url);
    expect(report.statusCode).toBe(200);
  });

  it("records a multi-hop redirect chain (301 → 302 → 200)", async () => {
    const { url, servers } = await startRedirectServer(
      [{ status: 301 }, { status: 302 }],
      { "x-frame-options": "DENY" },
    );
    serversToClose.push(...servers);

    const { report } = await scan(url);
    expect(report.redirectChain).toHaveLength(3);
    expect(report.statusCode).toBe(200);
    const grade = findGrade(report, "X-Frame-Options");
    expect(grade.grade).toBe("good");
  });

  it("grades headers from the final response, not redirects", async () => {
    const { url, servers } = await startRedirectServer(
      [
        {
          status: 301,
          headers: {
            "strict-transport-security":
              "max-age=31536000; includeSubDomains",
          },
        },
      ],
      {}, // final response has no security headers
    );
    serversToClose.push(...servers);

    const { report } = await scan(url);
    // HSTS was on the redirect, not the final — should be missing
    const grade = findGrade(report, "Strict-Transport-Security");
    expect(grade.grade).toBe("missing");
  });

  it("handles no redirects", async () => {
    const { url, server } = await startServer({
      "x-content-type-options": "nosniff",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    expect(report.redirectChain).toHaveLength(1);
    expect(report.finalUrl).toBe(url);
  });
});

// =============================================================
// SUMMARY COUNTS
// =============================================================

describe("Summary counts (end-to-end)", () => {
  it("fully secure site — 6 good, 0 weak, 0 missing", async () => {
    const { url, server } = await startServer({
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=()",
    });
    serversToClose.push(server);

    const { summary } = await scan(url);
    expect(summary.good).toBe(6);
    expect(summary.weak).toBe(0);
    expect(summary.missing).toBe(0);
  });

  it("completely bare site — 0 good, 0 weak, 6 missing", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { summary } = await scan(url);
    expect(summary.good).toBe(0);
    expect(summary.weak).toBe(0);
    expect(summary.missing).toBe(6);
  });

  it("mixed site — correct counts", async () => {
    const { url, server } = await startServer({
      // good
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      // weak
      "strict-transport-security": "max-age=3600",
      "content-security-policy": "default-src 'self' 'unsafe-inline'",
      // missing: referrer-policy, permissions-policy
      // leakage
      server: "nginx",
      "x-powered-by": "Express",
    });
    serversToClose.push(server);

    const { summary } = await scan(url);
    expect(summary.good).toBe(2);
    expect(summary.weak).toBe(2);
    expect(summary.missing).toBe(2);
    expect(summary.infoLeakage).toBe(2);
  });

  it("all weak site — 0 good, 6 weak, 0 missing", async () => {
    const { url, server } = await startServer({
      "strict-transport-security": "max-age=100",
      "content-security-policy": "default-src 'self' 'unsafe-eval'",
      "x-content-type-options": "wrong-value",
      "x-frame-options": "ALLOW-FROM https://evil.com",
      "referrer-policy": "unsafe-url",
      // permissions-policy has no weak state — only good or missing
      // so include it to get 5 weak + 1 good
      "permissions-policy": "camera=()",
    });
    serversToClose.push(server);

    const { summary } = await scan(url);
    expect(summary.good).toBe(1); // permissions-policy
    expect(summary.weak).toBe(5);
    expect(summary.missing).toBe(0);
  });
});

describe("Summary improvements (Phase 1)", () => {
  it("infoLeakage should be a count, not an array", async () => {
    const { url, server } = await startServer({
      "server": "Apache/2.4.51",
      "x-powered-by": "Express",
    });
    serversToClose.push(server);

    const { summary } = await scan(url);
    // Should be a number, not an array
    expect(typeof summary.infoLeakage).toBe("number");
    expect(summary.infoLeakage).toBe(2);
  });

  it("should include criticalFindings array", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { summary } = await scan(url);
    // Should have criticalFindings array
    expect(Array.isArray(summary.criticalFindings)).toBe(true);
    expect(summary.criticalFindings.length).toBeGreaterThan(0);
  });

  it("criticalFindings should include missing HSTS and CSP", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { summary } = await scan(url);
    expect(summary.criticalFindings).toContain("Missing HSTS header");
    expect(summary.criticalFindings).toContain("Missing CSP header");
  });

  it("criticalFindings should be limited to top 5", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { summary } = await scan(url);
    // Should have at most 5 critical findings
    expect(summary.criticalFindings.length).toBeLessThanOrEqual(5);
  });

  it("criticalFindings should prioritize missing HSTS and CSP", async () => {
    const { url, server } = await startServer({});
    serversToClose.push(server);

    const { summary } = await scan(url);
    // HSTS and CSP should be first if missing
    const firstTwo = summary.criticalFindings.slice(0, 2);
    expect(firstTwo).toContain("Missing HSTS header");
    expect(firstTwo).toContain("Missing CSP header");
  });
});

// =============================================================
// REPORT ARTIFACTS
// =============================================================

describe("Report file output (end-to-end)", () => {
  it("writes headers.json to correct path", async () => {
    const { url, server } = await startServer({
      "x-frame-options": "DENY",
    });
    serversToClose.push(server);

    const dir = tmpReportsDir();
    const jobId = crypto.randomUUID();
    await runHeadersScan(url, dir, jobId);

    const filePath = path.join(dir, jobId, "headers.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(written.url).toBe(url);
    expect(written.headers).toHaveLength(6);
    expect(written.statusCode).toBe(200);
  });

  it("report contains all expected fields", async () => {
    const { url, server } = await startServer({
      server: "Apache/2.4",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    });
    serversToClose.push(server);

    const dir = tmpReportsDir();
    const jobId = crypto.randomUUID();
    const { report } = await runHeadersScan(url, dir, jobId);

    expect(report.url).toBe(url);
    expect(report.finalUrl).toBe(url);
    expect(report.redirectChain).toEqual([url]);
    expect(report.statusCode).toBe(200);
    expect(report.headers).toHaveLength(6);
    expect(report.infoLeakage.length).toBeGreaterThanOrEqual(1);

    // Each header grade has the right shape
    for (const h of report.headers) {
      expect(h).toHaveProperty("header");
      expect(h).toHaveProperty("grade");
      expect(h).toHaveProperty("reason");
      expect(["good", "weak", "missing"]).toContain(h.grade);
    }
  });
});

import { describe, it, expect, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { runHttpScan } from "../../scanTypes/http/index.js";
import type { HttpReportData, HttpSummaryData } from "@penetragent/shared";

type HeaderMap = Record<string, string>;

async function startServer(
  headers: HeaderMap,
  statusCode = 200,
): Promise<{ url: string; server: FastifyInstance }> {
  const server = Fastify();
  server.get("/", async (_req, reply) => {
    reply.header("Content-Type", "text/html");
    for (const [key, value] of Object.entries(headers)) {
      reply.header(key, value);
    }
    return reply.status(statusCode).send("<html><body>ok</body></html>");
  });
  const address = await server.listen({ port: 0, host: "127.0.0.1" });
  return { url: address, server };
}

let serversToClose: FastifyInstance[] = [];

afterEach(async () => {
  for (const server of serversToClose) {
    await server.close();
  }
  serversToClose = [];
});

async function scan(
  url: string,
): Promise<{ report: HttpReportData; summary: HttpSummaryData }> {
  return runHttpScan(url, 1);
}

function findGrade(
  report: HttpReportData,
  headerName: string,
) {
  const grade = report.pages[0]?.headerGrades.find((h) => h.header === headerName);
  if (!grade) throw new Error(`Header grade not found for "${headerName}"`);
  return grade;
}

describe("HSTS grading (end-to-end via HTTP scan)", () => {
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
});

describe("CSP grading (end-to-end via HTTP scan)", () => {
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

describe("Summary counts (end-to-end via HTTP scan)", () => {
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
});

describe("Info leakage detection (end-to-end via HTTP scan)", () => {
  it("detects Server header", async () => {
    const { url, server } = await startServer({
      server: "Apache/2.4.51 (Ubuntu)",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const leaks = report.pages[0].infoLeakage;
    expect(leaks.some((l) => l.header === "Server" && l.value === "Apache/2.4.51 (Ubuntu)")).toBe(true);
  });

  it("detects X-Powered-By header", async () => {
    const { url, server } = await startServer({
      "x-powered-by": "Express",
    });
    serversToClose.push(server);

    const { report } = await scan(url);
    const leaks = report.pages[0].infoLeakage;
    expect(leaks.some((l) => l.header === "X-Powered-By" && l.value === "Express")).toBe(true);
  });
});

describe("Report data structure (end-to-end via HTTP scan)", () => {
  it("returns complete report and summary data", async () => {
    const { url, server } = await startServer({
      "x-frame-options": "DENY",
    });
    serversToClose.push(server);

    const { report, summary } = await scan(url);

    expect(report.startUrl).toBe(url);
    expect(report.pages[0].headerGrades).toHaveLength(6);
    expect(report.pages[0].statusCode).toBe(200);
    expect(report.redirectChain.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(report.metaGenerators)).toBe(true);

    expect(summary.good).toBeGreaterThanOrEqual(0);
    expect(summary.weak).toBeGreaterThanOrEqual(0);
    expect(summary.missing).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.criticalFindings)).toBe(true);
  });
});

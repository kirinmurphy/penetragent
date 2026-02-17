import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runHttpScan } from "../scanTypes/http/index.js";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

describe("HTTP Scan", () => {
  let testServer: FastifyInstance;
  const port = 9876;
  const baseUrl = `http://localhost:${port}`;

  beforeAll(async () => {
    testServer = Fastify();

    testServer.get("/", async (request, reply) => {
      reply
        .header("Content-Type", "text/html")
        .send(`
          <html>
            <head>
              <title>Test Page</title>
              <meta name="generator" content="TestCMS 1.0">
            </head>
            <body>
              <h1>Test Site</h1>
              <a href="/page1">Page 1</a>
              <a href="/page2">Page 2</a>
            </body>
          </html>
        `);
    });

    testServer.get("/page1", async (request, reply) => {
      reply
        .header("Content-Type", "text/html")
        .header("X-Frame-Options", "DENY")
        .send(`
          <html>
            <body><h1>Page 1</h1></body>
          </html>
        `);
    });

    testServer.get("/page2", async (request, reply) => {
      reply
        .header("Content-Type", "text/html")
        .header("Strict-Transport-Security", "max-age=31536000")
        .send(`
          <html>
            <body><h1>Page 2</h1></body>
          </html>
        `);
    });

    testServer.get("/with-issues", async (request, reply) => {
      reply
        .header("Content-Type", "text/html")
        .header("Server", "Apache/2.4.41")
        .header("X-Powered-By", "PHP/7.4.3")
        .send(`
          <html>
            <body>
              <h1>Page with issues</h1>
              <img src="http://example.com/image.jpg" />
            </body>
          </html>
        `);
    });

    await testServer.listen({ port, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await testServer.close();
  });

  it("should scan multiple pages", async () => {
    const { report, summary } = await runHttpScan(baseUrl);

    expect(report.startUrl).toBe(baseUrl);
    expect(report.pagesScanned).toBeGreaterThan(1);
    expect(summary.pagesScanned).toBeGreaterThan(1);
    expect(summary.pagesScanned).toBe(report.pagesScanned);
  });

  it("should include headerGrades per page", async () => {
    const { report } = await runHttpScan(baseUrl);

    for (const page of report.pages) {
      expect(page.headerGrades).toBeDefined();
      expect(Array.isArray(page.headerGrades)).toBe(true);
      expect(page.headerGrades.length).toBe(6);
      for (const grade of page.headerGrades) {
        expect(grade).toHaveProperty("header");
        expect(grade).toHaveProperty("grade");
        expect(grade).toHaveProperty("reason");
        expect(["good", "weak", "missing"]).toContain(grade.grade);
      }
    }
  });

  it("should include header grade summary counts", async () => {
    const { summary } = await runHttpScan(baseUrl);

    expect(typeof summary.good).toBe("number");
    expect(typeof summary.weak).toBe("number");
    expect(typeof summary.missing).toBe("number");
    expect(summary.good + summary.weak + summary.missing).toBe(6);
  });

  it("should extract metaGenerators from pages", async () => {
    const { report } = await runHttpScan(baseUrl);

    expect(report.metaGenerators).toBeDefined();
    expect(report.metaGenerators).toContain("TestCMS 1.0");
  });

  it("should track redirectChain for root page", async () => {
    const { report } = await runHttpScan(baseUrl);

    expect(report.redirectChain).toBeDefined();
    expect(Array.isArray(report.redirectChain)).toBe(true);
    expect(report.redirectChain.length).toBeGreaterThanOrEqual(1);
  });

  it("should detect information disclosure headers", async () => {
    const { report } = await runHttpScan(`${baseUrl}/with-issues`);

    const page = report.pages[0];
    expect(page.infoLeakage.length).toBeGreaterThan(0);
    const serverLeak = page.infoLeakage.find((l) => l.header === "Server");
    expect(serverLeak).toBeDefined();
    expect(serverLeak!.value).toContain("Apache");
  });

  it("should identify critical findings", async () => {
    const { summary } = await runHttpScan(baseUrl);

    expect(summary.criticalFindings.length).toBeGreaterThan(0);
    expect(summary.criticalFindings.some((f) => f.includes("Missing Strict-Transport-Security"))).toBe(true);
  });

  it("should return complete report data", async () => {
    const { report, summary } = await runHttpScan(baseUrl);

    expect(report.startUrl).toBe(baseUrl);
    expect(report.pagesScanned).toBeGreaterThan(0);
    expect(Array.isArray(report.pages)).toBe(true);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(report.timestamp).toBeTruthy();

    expect(summary.pagesScanned).toBe(report.pagesScanned);
    expect(summary.issuesFound).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.criticalFindings)).toBe(true);
  });

  it("should limit scan depth", async () => {
    const { report, summary } = await runHttpScan(baseUrl);

    expect(report.pagesScanned).toBeLessThanOrEqual(20);
    expect(summary.pagesScanned).toBeLessThanOrEqual(20);
  });

  it("should handle fetch errors gracefully", async () => {
    const { report } = await runHttpScan("http://localhost:1");

    expect(report.pages.length).toBe(1);
    expect(report.pages[0].statusCode).toBe(0);
    expect(report.pages[0].contentIssues[0]).toContain("Failed to fetch");
  });

  it("should include timestamp in report", async () => {
    const { report } = await runHttpScan(baseUrl);

    expect(report.timestamp).toBeTruthy();
    expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
  });

  it("should respect maxPages parameter", async () => {
    const { report } = await runHttpScan(baseUrl, 1);

    expect(report.pagesScanned).toBe(1);
  });
});

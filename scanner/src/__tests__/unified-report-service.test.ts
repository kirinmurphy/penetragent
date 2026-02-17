import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createUnifiedReport, loadUnifiedReport } from "../reports/unified-report-service.js";
import type { HttpReportData, HttpSummaryData } from "@penetragent/shared";

let tempDir: string;

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
});

function makeTempDir(): string {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "report-test-"));
  return tempDir;
}

function makeReport(overrides?: Partial<HttpReportData>): HttpReportData {
  return {
    startUrl: "https://example.com",
    pagesScanned: 1,
    pages: [{
      url: "https://example.com",
      statusCode: 200,
      contentType: "text/html",
      headerGrades: [
        { header: "Strict-Transport-Security", value: null, grade: "missing", reason: "Header not present" },
        { header: "Content-Security-Policy", value: null, grade: "missing", reason: "Header not present" },
      ],
      infoLeakage: [{ header: "Server", value: "Apache/2.4" }],
      contentIssues: [],
    }],
    findings: ["Missing Strict-Transport-Security header", "Missing Content-Security-Policy header", "Server header disclosed: Apache/2.4"],
    redirectChain: ["https://example.com"],
    metaGenerators: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeSummary(overrides?: Partial<HttpSummaryData>): HttpSummaryData {
  return {
    pagesScanned: 1,
    issuesFound: 3,
    good: 0,
    weak: 0,
    missing: 2,
    criticalFindings: ["Missing Strict-Transport-Security header", "Missing Content-Security-Policy header"],
    ...overrides,
  };
}

describe("createUnifiedReport", () => {
  it("builds report with http scan data", () => {
    const builder = createUnifiedReport("job-1", "https://example.com");
    builder.addHttpScan(makeReport(), makeSummary());
    const report = builder.build();

    expect(report.jobId).toBe("job-1");
    expect(report.targetUrl).toBe("https://example.com");
    expect(report.scanTypes).toEqual(["http"]);
    expect(report.scans.http).toBeDefined();
    expect(report.summary.http).toBeDefined();
  });

  it("deduplicates critical findings", () => {
    const builder = createUnifiedReport("job-1", "https://example.com");
    const summary = makeSummary({ criticalFindings: ["Missing Strict-Transport-Security header", "Missing Strict-Transport-Security header"] });
    builder.addHttpScan(makeReport(), summary);
    const report = builder.build();

    const hstsCounts = report.criticalFindings.filter((f) => f === "Missing Strict-Transport-Security header");
    expect(hstsCounts).toHaveLength(1);
  });

  it("detects technologies from scan data", () => {
    const report = makeReport({
      pages: [{
        url: "https://example.com",
        statusCode: 200,
        contentType: "text/html",
        headerGrades: [],
        infoLeakage: [{ header: "Server", value: "Apache/2.4" }],
        contentIssues: [],
      }],
      metaGenerators: ["WordPress 6.3"],
    });

    const builder = createUnifiedReport("job-1", "https://example.com");
    builder.addHttpScan(report, makeSummary());
    const built = builder.build();

    expect(built.detectedTechnologies.length).toBeGreaterThan(0);
    const techNames = built.detectedTechnologies.map((t) => t.name);
    expect(techNames).toContain("WordPress");
    expect(techNames).toContain("Apache");
  });

  it("writes and loads report", () => {
    const dir = makeTempDir();
    const builder = createUnifiedReport("job-1", "https://example.com");
    builder.addHttpScan(makeReport(), makeSummary());
    builder.write(dir);

    const loaded = loadUnifiedReport(dir, "job-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.jobId).toBe("job-1");
    expect(loaded!.scans.http).toBeDefined();
    expect(loaded!.detectedTechnologies).toBeDefined();
  });
});

describe("loadUnifiedReport", () => {
  it("returns null for missing report", () => {
    const dir = makeTempDir();
    expect(loadUnifiedReport(dir, "nonexistent")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { formatSummary } from "../format-summary.js";

describe("formatSummary", () => {
  it("should format flat objects with primitive values", () => {
    const summary = {
      good: 3,
      weak: 1,
      missing: 2,
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  Good: 3",
      "  Weak: 1",
      "  Missing: 2",
    ]);
  });

  it("should format arrays as comma-separated values", () => {
    const summary = {
      infoLeakage: ["Server: nginx", "X-Powered-By: PHP"],
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  Info Leakage: Server: nginx, X-Powered-By: PHP",
    ]);
  });

  it("should format empty arrays as 'none'", () => {
    const summary = {
      infoLeakage: [],
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  Info Leakage: none",
    ]);
  });

  it("should format nested objects with proper indentation", () => {
    const summary = {
      headers: { good: 3, weak: 1, missing: 2 },
      http: { pagesScanned: 15, issuesFound: 8 },
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  headers:",
      "    Good: 3",
      "    Weak: 1",
      "    Missing: 2",
      "  HTTP Analysis:",
      "    Pages Scanned: 15",
      "    Issues Found: 8",
    ]);
  });

  it("should show critical findings as a count", () => {
    const summary = {
      pagesScanned: 5,
      issuesFound: 3,
      criticalFindings: ["Missing HSTS", "Missing CSP"],
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  Pages Scanned: 5",
      "  Issues Found: 3",
      "  Critical Issues: 2",
    ]);
  });

  it("should allow custom indentation", () => {
    const summary = {
      good: 3,
      weak: 1,
    };

    const lines = formatSummary(summary, "    ");

    expect(lines).toEqual([
      "    Good: 3",
      "    Weak: 1",
    ]);
  });

  it("should handle null values", () => {
    const summary = {
      errorCode: null,
      status: "SUCCEEDED",
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  errorCode: null",
      "  status: SUCCEEDED",
    ]);
  });

  it("should handle empty objects", () => {
    const summary = {};

    const lines = formatSummary(summary);

    expect(lines).toEqual([]);
  });

  it("should show critical issues count in flat summary", () => {
    const summary = {
      good: 3,
      weak: 1,
      missing: 2,
      infoLeakage: 1,
      criticalFindings: ["Missing HSTS header", "Missing CSP header"],
    };

    const lines = formatSummary(summary);

    expect(lines).toContain("  Critical Issues: 2");
    expect(lines).not.toContain("  Critical Issues:");
  });

  it("should show critical issues count in nested summary", () => {
    const summary = {
      criticalFindings: [
        "Missing HSTS header",
        "Missing CSP header",
        "Server header disclosed: Apache",
      ],
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual(["  Critical Issues: 3"]);
  });

  it("should not show empty criticalFindings section", () => {
    const summary = {
      good: 6,
      criticalFindings: [],
    };

    const lines = formatSummary(summary);
    const joined = lines.join("\n");

    expect(joined).not.toContain("Critical");
  });

  it("should skip host field", () => {
    const summary = {
      host: "example.com",
      good: 3,
      weak: 0,
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  Good: 3",
      "  Weak: 0",
    ]);
  });

  it("should skip host in nested objects", () => {
    const summary = {
      tls: { host: "example.com", good: 4, missing: 1 },
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  SSL/TLS Analysis:",
      "    Good: 4",
      "    Missing: 1",
    ]);
  });
});

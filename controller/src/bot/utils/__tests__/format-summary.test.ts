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
      "  good: 3",
      "  weak: 1",
      "  missing: 2",
    ]);
  });

  it("should format arrays as comma-separated values", () => {
    const summary = {
      infoLeakage: ["Server: nginx", "X-Powered-By: PHP"],
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  infoLeakage: Server: nginx, X-Powered-By: PHP",
    ]);
  });

  it("should format empty arrays as 'none'", () => {
    const summary = {
      infoLeakage: [],
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  infoLeakage: none",
    ]);
  });

  it("should format nested objects with proper indentation", () => {
    const summary = {
      headers: { good: 3, weak: 1, missing: 2 },
      crawl: { pagesScanned: 15, issuesFound: 8 },
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  headers:",
      "    good: 3",
      "    weak: 1",
      "    missing: 2",
      "  crawl:",
      "    pagesScanned: 15",
      "    issuesFound: 8",
    ]);
  });

  it("should handle mixed types in summary", () => {
    const summary = {
      pagesScanned: 5,
      issuesFound: 3,
      criticalFindings: ["Missing HSTS", "Missing CSP"],
    };

    const lines = formatSummary(summary);

    expect(lines).toEqual([
      "  pagesScanned: 5",
      "  issuesFound: 3",
      "",
      "Critical Findings:",
      "  • Missing HSTS",
      "  • Missing CSP",
    ]);
  });

  it("should allow custom indentation", () => {
    const summary = {
      good: 3,
      weak: 1,
    };

    const lines = formatSummary(summary, "    ");

    expect(lines).toEqual([
      "    good: 3",
      "    weak: 1",
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

  it("should format criticalFindings as bullet list", () => {
    const summary = {
      good: 3,
      weak: 1,
      missing: 2,
      infoLeakage: 1,
      criticalFindings: ["Missing HSTS header", "Missing CSP header"],
    };

    const lines = formatSummary(summary);

    expect(lines).toContain("");
    expect(lines).toContain("Critical Findings:");
    expect(lines).toContain("  • Missing HSTS header");
    expect(lines).toContain("  • Missing CSP header");
  });

  it("should show critical findings prominently", () => {
    const summary = {
      criticalFindings: [
        "Missing HSTS header",
        "Missing CSP header",
        "Server header disclosed: Apache",
      ],
    };

    const lines = formatSummary(summary);
    const joined = lines.join("\n");

    expect(joined).toContain("Critical Findings:");
    expect(joined).toContain("• Missing HSTS header");
    expect(joined).toContain("• Missing CSP header");
    expect(joined).toContain("• Server header disclosed: Apache");
  });

  it("should not show empty criticalFindings section", () => {
    const summary = {
      good: 6,
      criticalFindings: [],
    };

    const lines = formatSummary(summary);
    const joined = lines.join("\n");

    expect(joined).not.toContain("Critical Findings:");
  });
});

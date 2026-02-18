import { describe, it, expect } from "vitest";
import type { UnifiedReport } from "@penetragent/shared";
import {
  aggregateIssues,
  getExplanationKey,
  computeWorstCaseGrades,
  classifyAndSortIssues,
  buildAiPromptData,
  buildPrintChecklist,
  collectMatchedFrameworks,
  processReportData,
} from "../reports/report-data-service.js";
import { makeHttpData, makePage, makeHeaderGrade, makeReport } from "./fixtures.js";

describe("aggregateIssues", () => {
  const cases = [
    {
      name: "groups missing headers across pages",
      input: makeHttpData(),
      expected: (result: Map<string, { pages: string[] }>) => {
        const hsts = result.get("Missing Strict-Transport-Security header");
        expect(hsts).toBeDefined();
        expect(hsts!.pages).toEqual(["https://example.com", "https://example.com/about"]);
      },
    },
    {
      name: "captures weak header issues",
      input: makeHttpData({
        pages: [makePage({
          headerGrades: [
            makeHeaderGrade({ header: "Referrer-Policy", value: "unsafe-url", grade: "weak", reason: "Leaks full URL" }),
          ],
        })],
      }),
      expected: (result: Map<string, { pages: string[] }>) => {
        const weak = result.get("Weak Referrer-Policy: Leaks full URL");
        expect(weak).toBeDefined();
        expect(weak!.pages).toEqual(["https://example.com"]);
      },
    },
    {
      name: "captures info leakage issues",
      input: makeHttpData({
        pages: [makePage({ infoLeakage: [{ header: "Server", value: "Apache/2.4" }] })],
      }),
      expected: (result: Map<string, { pages: string[] }>) => {
        const leak = result.get("Server header disclosed: Apache/2.4");
        expect(leak).toBeDefined();
        expect(leak!.pages).toEqual(["https://example.com"]);
      },
    },
    {
      name: "captures content issues",
      input: makeHttpData({
        pages: [makePage({ contentIssues: ["Mixed content detected on page"] })],
      }),
      expected: (result: Map<string, { pages: string[] }>) => {
        const content = result.get("Mixed content detected on page");
        expect(content).toBeDefined();
        expect(content!.pages).toEqual(["https://example.com"]);
      },
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => expected(aggregateIssues(input)));
  }
});

describe("getExplanationKey", () => {
  const cases = [
    { name: "strips Missing prefix and header suffix", input: "Missing Strict-Transport-Security header", expected: "Strict-Transport-Security" },
    { name: "strips Weak prefix and splits on colon", input: "Weak Referrer-Policy: Leaks full URL", expected: "Referrer-Policy" },
    { name: "returns other issues unchanged", input: "Mixed content detected", expected: "Mixed content detected" },
    { name: "handles info leakage patterns", input: "Server header disclosed: Apache/2.4", expected: "Server header disclosed: Apache/2.4" },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => expect(getExplanationKey(input)).toBe(expected));
  }
});

describe("computeWorstCaseGrades", () => {
  const cases = [
    {
      name: "counts all good when no issues",
      input: makeHttpData({
        pages: [makePage({
          headerGrades: [
            makeHeaderGrade({ header: "X-Content-Type-Options" }),
            makeHeaderGrade({ header: "X-Frame-Options", value: "DENY", reason: "OK" }),
          ],
        })],
      }),
      expected: { good: 2, weak: 0, missing: 0 },
    },
    {
      name: "promotes good to missing when any page is missing",
      input: makeHttpData({
        pages: [
          makePage({ headerGrades: [makeHeaderGrade({ header: "CSP" })] }),
          makePage({
            url: "https://example.com/about",
            headerGrades: [makeHeaderGrade({ header: "CSP", value: null, grade: "missing", reason: "Not present" })],
          }),
        ],
      }),
      expected: { good: 0, weak: 0, missing: 1 },
    },
    {
      name: "promotes good to weak across pages",
      input: makeHttpData({
        pages: [
          makePage({ headerGrades: [makeHeaderGrade({ header: "Referrer-Policy", value: "strict-origin", reason: "OK" })] }),
          makePage({
            url: "https://example.com/about",
            headerGrades: [makeHeaderGrade({ header: "Referrer-Policy", value: "unsafe-url", grade: "weak", reason: "Leaky" })],
          }),
        ],
      }),
      expected: { good: 0, weak: 1, missing: 0 },
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => expect(computeWorstCaseGrades(input)).toEqual(expected));
  }
});

describe("classifyAndSortIssues", () => {
  const cases = [
    {
      name: "marks HSTS as critical",
      input: {
        issueMap: new Map([["Missing Strict-Transport-Security header", { pages: ["https://a.com"] }]]),
        detectedTechs: [] as UnifiedReport["detectedTechnologies"],
      },
      expected: (result: ReturnType<typeof classifyAndSortIssues>) => {
        expect(result[0].isCritical).toBe(true);
      },
    },
    {
      name: "marks info leakage as non-critical",
      input: {
        issueMap: new Map([["Server header disclosed: Apache/2.4", { pages: ["https://a.com"] }]]),
        detectedTechs: [] as UnifiedReport["detectedTechnologies"],
      },
      expected: (result: ReturnType<typeof classifyAndSortIssues>) => {
        expect(result[0].isCritical).toBe(false);
      },
    },
    {
      name: "sorts by page count descending",
      input: {
        issueMap: new Map([
          ["Issue A", { pages: ["p1"] }],
          ["Issue B", { pages: ["p1", "p2", "p3"] }],
          ["Issue C", { pages: ["p1", "p2"] }],
        ]),
        detectedTechs: [] as UnifiedReport["detectedTechnologies"],
      },
      expected: (result: ReturnType<typeof classifyAndSortIssues>) => {
        expect(result.map((r) => r.issue)).toEqual(["Issue B", "Issue C", "Issue A"]);
      },
    },
    {
      name: "includes matched framework fixes for detected techs",
      input: {
        issueMap: new Map([["Missing Strict-Transport-Security header", { pages: ["https://a.com"] }]]),
        detectedTechs: [{ name: "Apache", confidence: "high" as const, source: "Server" }],
      },
      expected: (result: ReturnType<typeof classifyAndSortIssues>) => {
        expect(result[0].matchedFrameworks.length).toBeGreaterThan(0);
        expect(result[0].matchedFrameworks[0].framework).toBe("Apache");
        expect(result[0].matchedFrameworks[0].slug).toBe("apache");
      },
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => expected(classifyAndSortIssues(input)));
  }
});

describe("buildAiPromptData", () => {
  const cases = [
    {
      name: "returns null when no findings",
      input: { targetUrl: "https://example.com", detectedTechs: [] as UnifiedReport["detectedTechnologies"], findings: [] as string[] },
      expected: (result: ReturnType<typeof buildAiPromptData>) => {
        expect(result).toBeNull();
      },
    },
    {
      name: "builds prompt with tech stack and numbered findings",
      input: {
        targetUrl: "https://example.com",
        detectedTechs: [{ name: "Apache", confidence: "high" as const, source: "Server" }],
        findings: ["Missing HSTS", "Weak CSP"],
      },
      expected: (result: ReturnType<typeof buildAiPromptData>) => {
        expect(result).not.toBeNull();
        expect(result!.techStackLabel).toBe("Apache");
        expect(result!.promptText).toContain("https://example.com");
        expect(result!.promptText).toContain("Apache");
        expect(result!.promptText).toContain("1. Missing HSTS");
        expect(result!.promptText).toContain("2. Weak CSP");
      },
    },
    {
      name: "shows Unknown when no techs detected",
      input: {
        targetUrl: "https://example.com",
        detectedTechs: [] as UnifiedReport["detectedTechnologies"],
        findings: ["Some issue"],
      },
      expected: (result: ReturnType<typeof buildAiPromptData>) => {
        expect(result!.techStackLabel).toBe("Unknown");
        expect(result!.promptText).toContain("Unknown");
      },
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => expected(buildAiPromptData(input)));
  }
});

describe("buildPrintChecklist", () => {
  const cases = [
    {
      name: "maps issues to generic and framework fixes",
      input: {
        headerIssues: classifyAndSortIssues({
          issueMap: new Map([["Missing Strict-Transport-Security header", { pages: ["https://a.com"] }]]),
          detectedTechs: [{ name: "Apache", confidence: "high" as const, source: "Server" }],
        }),
        tlsIssues: [],
        cookieIssues: [],
        scriptIssues: [],
        corsIssues: [],
        matchedFrameworks: [{ name: "Apache", slug: "apache" }],
      },
      expected: (result: ReturnType<typeof buildPrintChecklist>) => {
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("Security Headers");
        expect(result[0].items).toHaveLength(1);
        expect(result[0].items[0].issue).toBe("Missing Strict-Transport-Security header");
        expect(result[0].items[0].genericFix).toContain("Strict-Transport-Security");
        expect(result[0].items[0].frameworkFixes.length).toBeGreaterThan(0);
        expect(result[0].items[0].frameworkFixes[0].framework).toBe("Apache");
      },
    },
    {
      name: "returns empty generic fix when no explanation exists",
      input: {
        headerIssues: classifyAndSortIssues({
          issueMap: new Map([["Unknown issue xyz", { pages: ["https://a.com"] }]]),
          detectedTechs: [],
        }),
        tlsIssues: [],
        cookieIssues: [],
        scriptIssues: [],
        corsIssues: [],
        matchedFrameworks: [],
      },
      expected: (result: ReturnType<typeof buildPrintChecklist>) => {
        expect(result[0].items[0].genericFix).toBe("");
        expect(result[0].items[0].frameworkFixes).toEqual([]);
      },
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => expected(buildPrintChecklist(input)));
  }
});

describe("collectMatchedFrameworks", () => {
  const cases = [
    {
      name: "returns frameworks that have fixes in explanations",
      input: [{ name: "Apache", confidence: "high" as const, source: "Server" }],
      expected: (result: ReturnType<typeof collectMatchedFrameworks>) => {
        expect(result.some((f) => f.name === "Apache")).toBe(true);
        expect(result.some((f) => f.slug === "apache")).toBe(true);
      },
    },
    {
      name: "returns empty array when no tech matches",
      input: [{ name: "UnknownFramework", confidence: "low" as const, source: "guess" }],
      expected: (result: ReturnType<typeof collectMatchedFrameworks>) => {
        expect(result).toEqual([]);
      },
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => expected(collectMatchedFrameworks(input)));
  }
});

describe("processReportData", () => {
  it("assembles full ProcessedReportData from a UnifiedReport", () => {
    const report = makeReport();
    const data = processReportData(report);

    expect(data.targetUrl).toBe("https://example.com");
    expect(data.timestamp).toBe("2025-01-15T12:00:00Z");
    expect(data.isMultiPage).toBe(true);
    expect(data.totalPages).toBe(2);
    expect(data.redirectChain).toEqual(["https://example.com"]);
    expect(data.headerGradeSummary.missing).toBeGreaterThan(0);
    expect(data.issues.length).toBeGreaterThan(0);
    expect(data.matchedFrameworks.length).toBeGreaterThan(0);
    expect(data.aiPrompt).not.toBeNull();
    expect(data.scannedPages).toHaveLength(2);
    expect(data.printChecklist.length).toBeGreaterThan(0);
    expect(data.formattedDate).toContain("2025");
  });

  it("handles report with no http data", () => {
    const report = makeReport({ scans: {}, summary: {} });
    const data = processReportData(report);

    expect(data.totalPages).toBe(0);
    expect(data.isMultiPage).toBe(false);
    expect(data.issues).toEqual([]);
    expect(data.aiPrompt).toBeNull();
    expect(data.scannedPages).toEqual([]);
    expect(data.headerGradeSummary).toEqual({ good: 0, weak: 0, missing: 0 });
  });
});

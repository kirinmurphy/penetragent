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

function makeHttpData(
  overrides?: Partial<NonNullable<UnifiedReport["scans"]["http"]>>,
): NonNullable<UnifiedReport["scans"]["http"]> {
  return {
    startUrl: "https://example.com",
    pagesScanned: 2,
    pages: [
      {
        url: "https://example.com",
        statusCode: 200,
        contentType: "text/html",
        headerGrades: [
          { header: "Strict-Transport-Security", value: null, grade: "missing", reason: "Header not present" },
          { header: "Content-Security-Policy", value: "default-src 'self'", grade: "good", reason: "Present" },
        ],
        infoLeakage: [{ header: "Server", value: "Apache/2.4" }],
        contentIssues: ["Mixed content detected on page"],
      },
      {
        url: "https://example.com/about",
        statusCode: 200,
        contentType: "text/html",
        headerGrades: [
          { header: "Strict-Transport-Security", value: null, grade: "missing", reason: "Header not present" },
          { header: "Content-Security-Policy", value: null, grade: "missing", reason: "Header not present" },
        ],
        infoLeakage: [],
        contentIssues: [],
      },
    ],
    findings: ["Missing Strict-Transport-Security header"],
    redirectChain: ["https://example.com"],
    metaGenerators: [],
    timestamp: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeReport(overrides?: Partial<UnifiedReport>): UnifiedReport {
  return {
    jobId: "test-job",
    targetUrl: "https://example.com",
    scanTypes: ["http"],
    timestamp: "2025-01-15T12:00:00Z",
    scans: { http: makeHttpData() },
    summary: {
      http: {
        pagesScanned: 2,
        issuesFound: 3,
        good: 1,
        weak: 0,
        missing: 1,
        criticalFindings: [],
      },
    },
    detectedTechnologies: [
      { name: "Apache", confidence: "high", source: "Server: Apache/2.4" },
    ],
    criticalFindings: [],
    ...overrides,
  };
}

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
        pages: [{
          url: "https://example.com",
          statusCode: 200,
          contentType: "text/html",
          headerGrades: [
            { header: "Referrer-Policy", value: "unsafe-url", grade: "weak", reason: "Leaks full URL" },
          ],
          infoLeakage: [],
          contentIssues: [],
        }],
      }),
      expected: (result: Map<string, { pages: string[] }>) => {
        const weak = result.get("Weak Referrer-Policy: Leaks full URL");
        expect(weak).toBeDefined();
        expect(weak!.pages).toEqual(["https://example.com"]);
      },
    },
    {
      name: "captures info leakage issues",
      input: makeHttpData(),
      expected: (result: Map<string, { pages: string[] }>) => {
        const leak = result.get("Server header disclosed: Apache/2.4");
        expect(leak).toBeDefined();
        expect(leak!.pages).toEqual(["https://example.com"]);
      },
    },
    {
      name: "captures content issues",
      input: makeHttpData(),
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
        pages: [{
          url: "https://example.com",
          statusCode: 200,
          contentType: "text/html",
          headerGrades: [
            { header: "X-Content-Type-Options", value: "nosniff", grade: "good", reason: "OK" },
            { header: "X-Frame-Options", value: "DENY", grade: "good", reason: "OK" },
          ],
          infoLeakage: [],
          contentIssues: [],
        }],
      }),
      expected: { good: 2, weak: 0, missing: 0 },
    },
    {
      name: "promotes good to missing when any page is missing",
      input: makeHttpData({
        pages: [
          {
            url: "https://example.com",
            statusCode: 200,
            contentType: "text/html",
            headerGrades: [
              { header: "CSP", value: "default-src 'self'", grade: "good", reason: "OK" },
            ],
            infoLeakage: [],
            contentIssues: [],
          },
          {
            url: "https://example.com/about",
            statusCode: 200,
            contentType: "text/html",
            headerGrades: [
              { header: "CSP", value: null, grade: "missing", reason: "Not present" },
            ],
            infoLeakage: [],
            contentIssues: [],
          },
        ],
      }),
      expected: { good: 0, weak: 0, missing: 1 },
    },
    {
      name: "promotes good to weak across pages",
      input: makeHttpData({
        pages: [
          {
            url: "https://example.com",
            statusCode: 200,
            contentType: "text/html",
            headerGrades: [
              { header: "Referrer-Policy", value: "strict-origin", grade: "good", reason: "OK" },
            ],
            infoLeakage: [],
            contentIssues: [],
          },
          {
            url: "https://example.com/about",
            statusCode: 200,
            contentType: "text/html",
            headerGrades: [
              { header: "Referrer-Policy", value: "unsafe-url", grade: "weak", reason: "Leaky" },
            ],
            infoLeakage: [],
            contentIssues: [],
          },
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

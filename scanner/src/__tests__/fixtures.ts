import type { UnifiedReport } from "@penetragent/shared";

type HttpScanData = NonNullable<UnifiedReport["scans"]["http"]>;
type PageData = HttpScanData["pages"][number];
type HeaderGrade = PageData["headerGrades"][number];

export function makeHeaderGrade(overrides?: Partial<HeaderGrade>): HeaderGrade {
  return {
    header: "X-Content-Type-Options",
    value: "nosniff",
    grade: "good",
    reason: "Correctly set to nosniff",
    ...overrides,
  };
}

export function makePage(overrides?: Partial<PageData>): PageData {
  return {
    url: "https://example.com",
    statusCode: 200,
    contentType: "text/html",
    headerGrades: [
      makeHeaderGrade({ header: "Strict-Transport-Security", value: null, grade: "missing", reason: "Header not present" }),
      makeHeaderGrade({ header: "Content-Security-Policy", value: "default-src 'self'", grade: "good", reason: "Present" }),
    ],
    infoLeakage: [],
    contentIssues: [],
    ...overrides,
  };
}

export function makeHttpData(overrides?: Partial<HttpScanData>): HttpScanData {
  return {
    startUrl: "https://example.com",
    pagesScanned: 2,
    pages: [
      makePage(),
      makePage({
        url: "https://example.com/about",
        headerGrades: [
          makeHeaderGrade({ header: "Strict-Transport-Security", value: null, grade: "missing", reason: "Header not present" }),
          makeHeaderGrade({ header: "Content-Security-Policy", value: null, grade: "missing", reason: "Header not present" }),
        ],
      }),
    ],
    findings: ["Missing Strict-Transport-Security header"],
    redirectChain: ["https://example.com"],
    metaGenerators: [],
    timestamp: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeReport(overrides?: Partial<UnifiedReport>): UnifiedReport {
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

import { describe, it, expect } from "vitest";
import { generateHtmlReport } from "../reports/html/index.js";
import type { UnifiedReport } from "@penetragent/shared";

function makeReport(overrides?: Partial<UnifiedReport>): UnifiedReport {
  return {
    jobId: "test-job",
    targetUrl: "https://example.com",
    scanTypes: ["http"],
    timestamp: new Date().toISOString(),
    scans: {
      http: {
        startUrl: "https://example.com",
        pagesScanned: 2,
        pages: [
          {
            url: "https://example.com",
            statusCode: 200,
            contentType: "text/html",
            headerGrades: [
              { header: "Strict-Transport-Security", value: null, grade: "missing", reason: "Header not present" },
              { header: "Content-Security-Policy", value: "default-src 'self'", grade: "good", reason: "Present without unsafe directives" },
              { header: "X-Content-Type-Options", value: "nosniff", grade: "good", reason: "Correctly set to nosniff" },
              { header: "X-Frame-Options", value: null, grade: "missing", reason: "Header not present" },
              { header: "Referrer-Policy", value: "unsafe-url", grade: "weak", reason: "Set to unsafe-url which leaks full URL" },
              { header: "Permissions-Policy", value: null, grade: "missing", reason: "Header not present" },
            ],
            infoLeakage: [{ header: "Server", value: "Apache/2.4" }],
            contentIssues: [],
          },
          {
            url: "https://example.com/about",
            statusCode: 200,
            contentType: "text/html",
            headerGrades: [
              { header: "Strict-Transport-Security", value: null, grade: "missing", reason: "Header not present" },
              { header: "Content-Security-Policy", value: null, grade: "missing", reason: "Header not present" },
              { header: "X-Content-Type-Options", value: null, grade: "missing", reason: "Header not present" },
              { header: "X-Frame-Options", value: null, grade: "missing", reason: "Header not present" },
              { header: "Referrer-Policy", value: null, grade: "missing", reason: "Header not present" },
              { header: "Permissions-Policy", value: null, grade: "missing", reason: "Header not present" },
            ],
            infoLeakage: [],
            contentIssues: [],
          },
        ],
        findings: [
          "Missing Strict-Transport-Security header",
          "Missing X-Frame-Options header",
          "Missing Permissions-Policy header",
          "Weak Referrer-Policy: Set to unsafe-url which leaks full URL",
          "Server header disclosed: Apache/2.4",
        ],
        redirectChain: ["https://example.com"],
        metaGenerators: ["WordPress 6.3"],
        timestamp: new Date().toISOString(),
      },
    },
    summary: {
      http: {
        pagesScanned: 2,
        issuesFound: 5,
        good: 0,
        weak: 0,
        missing: 6,
        criticalFindings: ["Missing Strict-Transport-Security header"],
      },
    },
    detectedTechnologies: [
      { name: "WordPress", confidence: "high", source: "meta generator: WordPress 6.3" },
      { name: "Apache", confidence: "high", source: "Server: Apache/2.4" },
    ],
    criticalFindings: ["Missing Strict-Transport-Security header"],
    ...overrides,
  };
}

const cases = [
  {
    name: "renders issue cards for missing headers",
    check: (html: string) => {
      expect(html).toContain("issue-card");
      expect(html).toContain("Missing Strict-Transport-Security header");
    },
  },
  {
    name: "contains issue-details and issue-fix elements for control bar",
    check: (html: string) => {
      expect(html).toContain("issue-details");
      expect(html).toContain("issue-fix");
      expect(html).toContain("issue-fix-generic");
    },
  },
  {
    name: "sticky control bar with Show Issue Explanation and Suggested Solutions",
    check: (html: string) => {
      expect(html).toContain("control-bar");
      expect(html).toContain("toggle-details");
      expect(html).toContain("Show Issue Explanation");
      expect(html).toContain("Suggested Solutions");
      expect(html).toContain('data-fw="generic"');
      expect(html).toContain("Default");
    },
  },
  {
    name: "shows detected framework buttons in control bar",
    check: (html: string) => {
      expect(html).toContain('data-fw="wordpress"');
      expect(html).toContain('data-fw="apache"');
      expect(html).toContain(">WordPress</button>");
      expect(html).toContain(">Apache</button>");
    },
  },
  {
    name: "shows All pages badge for issues on every page",
    check: (html: string) => {
      expect(html).toContain("All pages</span>");
      expect(html).toContain("openScannedPages()");
    },
  },
  {
    name: "shows expandable page list for partial-page issues",
    check: (html: string) => {
      expect(html).toContain("togglePages(this)");
      expect(html).toContain("caret");
      expect(html).toContain("issue-card-pages");
    },
  },
  {
    name: "contains AI agent fix prompt",
    check: (html: string) => {
      expect(html).toContain("Prompt for AI Agent Fix");
      expect(html).toContain("copyPrompt");
      expect(html).toContain("Copy to clipboard");
    },
  },
  {
    name: "shows framework-specific fix sections for detected tech",
    check: (html: string) => {
      expect(html).toContain("issue-fix-wordpress");
      expect(html).toContain("issue-fix-apache");
    },
  },
  {
    name: "target URL is a clickable link with larger font",
    check: (html: string) => {
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain("font-size: 1.3em");
    },
  },
  {
    name: "scanned pages collapsed in details with id for linking",
    check: (html: string) => {
      expect(html).toContain("Scanned Pages (2)");
      expect(html).toContain('id="scanned-pages"');
    },
  },
  {
    name: "contains control bar JavaScript",
    check: (html: string) => {
      expect(html).toContain("toggle-details");
      expect(html).toContain("issue-fix-");
      expect(html).toContain("classList");
    },
  },
  {
    name: "explanation content uses inline format with Why it matters",
    check: (html: string) => {
      expect(html).toContain("Why it matters:");
    },
  },
  {
    name: "AI prompt is always visible",
    check: (html: string) => {
      expect(html).toContain("ai-prompt-collapsible");
      expect(html).toContain("ai-prompt-header");
    },
  },
  {
    name: "AI prompt includes description",
    check: (html: string) => {
      expect(html).toContain("ai-prompt-description");
      expect(html).toContain("Copy this prompt into an AI assistant");
    },
  },
  {
    name: "print checklist section renders with framework buttons",
    check: (html: string) => {
      expect(html).toContain("print-checklist-bar");
      expect(html).toContain("Print Resolution Checklist");
      expect(html).toContain("print-btn");
    },
  },
  {
    name: "hidden print view with checklist items and checkboxes",
    check: (html: string) => {
      expect(html).toContain("print-view");
      expect(html).toContain("print-item");
      expect(html).toContain('type="checkbox"');
      expect(html).toContain("Security Scan Resolution Checklist");
    },
  },
  {
    name: "print view includes framework-specific fixes",
    check: (html: string) => {
      expect(html).toContain("print-fix-wordpress");
      expect(html).toContain("print-fix-apache");
    },
  },
  {
    name: "control bar is right-aligned",
    check: (html: string) => {
      expect(html).toContain("justify-content: flex-end");
    },
  },
  {
    name: "issue cards render explanations for header issues",
    check: (html: string) => {
      expect(html).toContain("issue-card-body");
      expect(html).toContain("HSTS tells browsers");
    },
  },
];

describe("generateHtmlReport", () => {
  const report = makeReport();
  const html = generateHtmlReport(report);

  for (const { name, check } of cases) {
    it(name, () => check(html));
  }

  it("does not show page badges for single-page scans", () => {
    const singlePageReport = makeReport({
      scans: {
        http: {
          ...makeReport().scans.http!,
          pages: [makeReport().scans.http!.pages[0]],
          pagesScanned: 1,
        },
      },
    });
    const singlePageHtml = generateHtmlReport(singlePageReport);
    expect(singlePageHtml).toContain("issue-card");
    expect(singlePageHtml).not.toContain("badge count");
    expect(singlePageHtml).not.toContain("Scanned Pages");
    expect(singlePageHtml).not.toContain("togglePages(this)");
  });

  it("hides AI prompt when no findings", () => {
    const noFindingsReport = makeReport({
      scans: {
        http: {
          ...makeReport().scans.http!,
          findings: [],
        },
      },
    });
    const noFindingsHtml = generateHtmlReport(noFindingsReport);
    expect(noFindingsHtml).not.toContain("Prompt for AI Agent Fix");
  });

  it("shows no framework buttons when no technologies detected", () => {
    const noTechReport = makeReport({ detectedTechnologies: [] });
    const noTechHtml = generateHtmlReport(noTechReport);
    expect(noTechHtml).toContain('data-fw="generic"');
    expect(noTechHtml).not.toContain('data-fw="wordpress"');
    expect(noTechHtml).not.toContain('data-fw="apache"');
  });

  it("hides print checklist when no findings", () => {
    const allGoodReport = makeReport({
      scans: {
        http: {
          ...makeReport().scans.http!,
          pages: [{
            url: "https://example.com",
            statusCode: 200,
            contentType: "text/html",
            headerGrades: [
              { header: "Strict-Transport-Security", value: "max-age=31536000", grade: "good", reason: "Correctly configured" },
            ],
            infoLeakage: [],
            contentIssues: [],
          }],
          findings: [],
          pagesScanned: 1,
        },
      },
    });
    const html = generateHtmlReport(allGoodReport);
    expect(html).not.toContain("Print Resolution Checklist");
    expect(html).not.toContain("Security Scan Resolution Checklist");
  });
});

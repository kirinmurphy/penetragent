export const GRADE = {
  GOOD: "good",
  WEAK: "weak",
  MISSING: "missing",
} as const;

export type Grade = (typeof GRADE)[keyof typeof GRADE];

export const HEADERS_CONFIG = {
  maxRedirects: 10,
  maxCriticalFindings: 5,
  priorityHeaders: ["Strict-Transport-Security", "Content-Security-Policy"],
};

export const CRAWL_CONFIG = {
  maxPages: 20,
  requestTimeoutMs: 15_000,
  userAgent: "PenetragentCrawl/1.0 (Security Scanner)",
  securityChecks: {
    requiredHeaders: [
      { header: "strict-transport-security", finding: "Missing HSTS header" },
      { header: "content-security-policy", finding: "Missing CSP header" },
      { header: "x-content-type-options", finding: "Missing X-Content-Type-Options header" },
      { header: "x-frame-options", finding: "Missing X-Frame-Options header" },
    ],
    infoDisclosureHeaders: [
      { header: "server", displayName: "Server" },
      { header: "x-powered-by", displayName: "X-Powered-By" },
    ],
    mixedContentCheck: true,
    xssPatternCheck: true,
  },
  criticalFindingPatterns: ["Missing HSTS", "Missing CSP", "Mixed content", "XSS"],
};

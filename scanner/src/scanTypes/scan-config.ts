export const GRADE = {
  GOOD: "good",
  WEAK: "weak",
  MISSING: "missing",
} as const;

export type Grade = (typeof GRADE)[keyof typeof GRADE];

export const HTTP_SCAN_CONFIG = {
  maxPages: 20,
  maxRedirects: 10,
  maxCriticalFindings: 5,
  requestTimeoutMs: 15_000,
  userAgent: "PenetragentCrawl/1.0 (Security Scanner)",
  mixedContentCheck: true,
  xssPatternCheck: true,
  criticalFindingPatterns: ["Missing Strict-Transport-Security", "Missing Content-Security-Policy", "Mixed content", "XSS"],
};

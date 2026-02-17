export const GRADE = {
  GOOD: "good",
  WEAK: "weak",
  MISSING: "missing",
} as const;

export type Grade = (typeof GRADE)[keyof typeof GRADE];

export const GRADE_SEVERITY: Record<string, number> = {
  [GRADE.GOOD]: 0,
  [GRADE.WEAK]: 1,
  [GRADE.MISSING]: 2,
};

export const HTTP_SCAN_CONFIG = {
  maxPages: 20,
  maxRedirects: 10,
  maxCriticalFindings: 5,
  requestTimeoutMs: 15_000,
  userAgent: "PenetragentHTTP/1.0 (Security Scanner)",
  mixedContentCheck: true,
  xssPatternCheck: true,
  criticalFindingPatterns: ["Missing Strict-Transport-Security", "Missing Content-Security-Policy", "Mixed content", "XSS"],
  contentCheckPatterns: {
    mixedContent: /src=["']http:\/\/[^"']+["']/gi,
    xssIndicators: ['<script>alert(', 'javascript:'],
  },
  metaGeneratorPatterns: [
    /<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']generator["']/i,
  ],
};

export const HEADER_RULES = {
  hsts: {
    minMaxAge: 31536000,
    maxAgePattern: /max-age=(\d+)/i,
    subDomainsPattern: /includeSubDomains/i,
  },
  csp: {
    unsafeDirectives: [/unsafe-inline/i, /unsafe-eval/i],
  },
  xContentTypeOptions: {
    expectedValue: "nosniff",
  },
  xFrameOptions: {
    validValues: ["DENY", "SAMEORIGIN"],
  },
  referrerPolicy: {
    weakValues: ["unsafe-url"],
  },
  infoLeakageHeaders: [
    { key: "server", display: "Server" },
    { key: "x-powered-by", display: "X-Powered-By" },
  ],
};

// ══════════════════════════════════════════════════════════════
// Consolidated scan rules & configuration
// This file contains every tunable threshold, pattern, grading
// criterion, and detection rule used by the scanner.
// ══════════════════════════════════════════════════════════════

// ── Grade System ─────────────────────────────────────────────

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

// ── Issue Classification ─────────────────────────────────────

export const ISSUE_CATEGORY_PREFIXES = {
  cookies: ["Missing HttpOnly", "Missing Secure flag", "Missing SameSite", "SameSite=None"],
  scripts: ["Missing Subresource Integrity", "Known vulnerable library"],
  cors: ["CORS", "Wildcard CORS"],
} as const;

export type IssueCategory = "headers" | "cookies" | "scripts" | "cors";

export const SECTION_LABELS: Record<string, string> = {
  headers: "Security Headers",
  cookies: "Cookie Security",
  scripts: "Script & Dependency Security",
  cors: "CORS Configuration",
  tls: "SSL/TLS",
};

// ── HTTP Scan Configuration ──────────────────────────────────

export const HTTP_SCAN_CONFIG = {
  maxPages: 20,
  maxRedirects: 10,
  maxCriticalFindings: 5,
  requestTimeoutMs: 15_000,
  userAgent: "PenetragentHTTP/1.0 (Security Scanner)",
  mixedContentCheck: true,
  xssPatternCheck: true,
  criticalFindingPatterns: [
    "Missing Strict-Transport-Security",
    "Missing Content-Security-Policy",
    "Mixed content",
    "XSS",
    "CORS credential reflection",
    "Missing HttpOnly flag",
    "Missing Secure flag",
  ],
  contentCheckPatterns: {
    mixedContent: /src=["']http:\/\/[^"']+["']/gi,
    xssIndicators: ["<script>alert(", "javascript:"],
  },
  metaGeneratorPatterns: [
    /<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']generator["']/i,
  ],
};

// ── Header Grading Rules ─────────────────────────────────────

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

// ── Cookie Analysis ──────────────────────────────────────────

export const COOKIE_ANALYSIS_CONFIG = {
  checkHttpOnly: true,
  checkSecure: true,
  checkSameSite: true,
  checkSameSiteNoneWithoutSecure: true,
};

// ── Script Analysis ──────────────────────────────────────────

export const SCRIPT_ANALYSIS_CONFIG = {
  checkSri: true,
  vulnerablePatterns: [
    { pattern: /jquery[.-]1\./i, label: "jQuery 1.x (known vulnerabilities)" },
    { pattern: /jquery[.-]2\./i, label: "jQuery 2.x (known vulnerabilities)" },
    { pattern: /angular[.-]1\./i, label: "AngularJS 1.x (end of life)" },
    { pattern: /bootstrap[.-]2\./i, label: "Bootstrap 2.x (known vulnerabilities)" },
    { pattern: /bootstrap[.-]3\./i, label: "Bootstrap 3.x (known vulnerabilities)" },
    { pattern: /lodash[.-][123]\./i, label: "Lodash <4.x (prototype pollution)" },
  ],
};

// ── CORS Analysis ────────────────────────────────────────────

export const CORS_ANALYSIS_CONFIG = {
  testOrigin: "https://evil.example.com",
  timeoutMs: 10_000,
};

// ── TLS Scan Configuration ───────────────────────────────────

export const TLS_SCAN_CONFIG = {
  connectionTimeoutMs: 10_000,
  port: 443,
  certExpiryWarningDays: 30,

  deprecatedProtocols: ["TLSv1", "TLSv1.1"],
  requiredProtocols: ["TLSv1.2", "TLSv1.3"],

  protocolVersionMap: {
    "TLSv1": { minVersion: "TLSv1" as const, maxVersion: "TLSv1" as const },
    "TLSv1.1": { minVersion: "TLSv1.1" as const, maxVersion: "TLSv1.1" as const },
    "TLSv1.2": { minVersion: "TLSv1.2" as const, maxVersion: "TLSv1.2" as const },
    "TLSv1.3": { minVersion: "TLSv1.3" as const, maxVersion: "TLSv1.3" as const },
  },

  weakCipherPatterns: [
    /RC4/i,
    /\bDES\b/i,
    /3DES/i,
    /EXPORT/i,
    /NULL/i,
    /anon/i,
    /MD5/i,
  ],

  forwardSecrecyPatterns: [
    /ECDHE/i,
    /DHE/i,
  ],

  criticalFindingPatterns: [
    "Certificate expired",
    "Self-signed certificate",
    "Hostname mismatch",
    "is deprecated and should be disabled",
    "Weak cipher",
  ],
};

// ── Technology Detection Rules ───────────────────────────────

export interface TechRule {
  name: string;
  urlPatterns?: RegExp[];
  headerMatches?: { header: string; pattern: RegExp }[];
  metaGeneratorPatterns?: RegExp[];
  certIssuerPatterns?: RegExp[];
}

export const TECH_RULES: TechRule[] = [
  {
    name: "WordPress",
    urlPatterns: [/\/wp-content\//, /\/wp-includes\//, /\/wp-admin\//, /\/wp-json\//],
    metaGeneratorPatterns: [/WordPress/i],
  },
  {
    name: "Drupal",
    urlPatterns: [/\/sites\/default\//, /\/modules\//, /\/themes\/contrib\//],
    metaGeneratorPatterns: [/Drupal/i],
  },
  {
    name: "Joomla",
    urlPatterns: [/\/components\/com_/, /\/media\/jui\//],
    metaGeneratorPatterns: [/Joomla/i],
  },
  {
    name: "Next.js",
    urlPatterns: [/\/_next\//, /\/__next\//],
    metaGeneratorPatterns: [/Next\.js/i],
  },
  {
    name: "Nuxt.js",
    urlPatterns: [/\/_nuxt\//],
    metaGeneratorPatterns: [/Nuxt/i],
  },
  {
    name: "Hugo",
    metaGeneratorPatterns: [/Hugo/i],
  },
  {
    name: "Ghost",
    metaGeneratorPatterns: [/Ghost/i],
  },
  {
    name: "nginx",
    headerMatches: [{ header: "Server", pattern: /nginx/i }],
  },
  {
    name: "Apache",
    headerMatches: [{ header: "Server", pattern: /Apache/i }],
  },
  {
    name: "Express",
    headerMatches: [{ header: "X-Powered-By", pattern: /Express/i }],
  },
  {
    name: "PHP",
    headerMatches: [{ header: "X-Powered-By", pattern: /PHP/i }],
  },
  {
    name: "ASP.NET",
    headerMatches: [{ header: "X-Powered-By", pattern: /ASP\.NET/i }],
  },
  {
    name: "Cloudflare",
    headerMatches: [{ header: "Server", pattern: /cloudflare/i }],
    certIssuerPatterns: [/Cloudflare/i],
  },
  {
    name: "Let's Encrypt",
    certIssuerPatterns: [/Let's Encrypt|R3$|E1$|R10$|R11$/i],
  },
];

export const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;

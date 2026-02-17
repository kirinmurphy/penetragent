export const HTTP_SCAN_CONFIG = {
  maxPages: 20,
  maxRedirects: 10,
  maxCriticalFindings: 5,
  requestTimeoutMs: 15_000,
  userAgent: "PenetragentHTTP/1.0 (Security Scanner)",
  mixedContentCheck: true,
  xssPatternCheck: true,
  criticalFindingPatterns: ["Missing Strict-Transport-Security", "Missing Content-Security-Policy", "Mixed content", "XSS", "CORS credential reflection", "Missing HttpOnly flag", "Missing Secure flag"],
  contentCheckPatterns: {
    mixedContent: /src=["']http:\/\/[^"']+["']/gi,
    xssIndicators: ['<script>alert(', 'javascript:'],
  },
  metaGeneratorPatterns: [
    /<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']generator["']/i,
  ],
};

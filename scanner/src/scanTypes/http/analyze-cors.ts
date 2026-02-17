import type { CorsIssue } from "@penetragent/shared";

const CORS_ANALYSIS_CONFIG = {
  testOrigin: "https://evil.example.com",
  timeoutMs: 10_000,
};

export async function analyzeCors(url: string): Promise<CorsIssue[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "Origin": CORS_ANALYSIS_CONFIG.testOrigin,
      },
      signal: AbortSignal.timeout(CORS_ANALYSIS_CONFIG.timeoutMs),
    });

    const allowOrigin = response.headers.get("access-control-allow-origin");
    const allowCredentials = response.headers.get("access-control-allow-credentials") === "true";

    if (!allowOrigin) return [];

    const issues: string[] = [];

    if (allowOrigin === "*") {
      issues.push("Wildcard CORS origin: server allows requests from any origin");
    }

    if (allowOrigin === CORS_ANALYSIS_CONFIG.testOrigin) {
      issues.push("CORS origin reflection: server reflects arbitrary Origin header");
    }

    if (allowCredentials && allowOrigin === CORS_ANALYSIS_CONFIG.testOrigin) {
      issues.push("CORS credential reflection: server reflects origin with credentials allowed");
    }

    if (issues.length === 0) return [];
    return [{ url, allowOrigin, allowCredentials, issues }];
  } catch {
    return [];
  }
}

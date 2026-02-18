import type { CookieIssue } from "@penetragent/shared";
import { COOKIE_ANALYSIS_CONFIG } from "../../config/scan-rules.js";

function parseCookieName(raw: string): string {
  const eqIndex = raw.indexOf("=");
  if (eqIndex === -1) return raw.trim();
  return raw.substring(0, eqIndex).trim();
}

function hasAttribute(raw: string, attribute: string): boolean {
  const lower = raw.toLowerCase();
  return lower.includes(`;${attribute}`) || lower.includes(`; ${attribute}`);
}

function getSameSiteValue(raw: string): string | null {
  const match = raw.match(/;\s*samesite\s*=\s*([^;]+)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

function analyzeSingleCookie(raw: string, url: string): CookieIssue | null {
  const name = parseCookieName(raw);
  const issues: string[] = [];

  if (COOKIE_ANALYSIS_CONFIG.checkHttpOnly && !hasAttribute(raw, "httponly")) {
    issues.push(`Missing HttpOnly flag on cookie '${name}'`);
  }

  if (COOKIE_ANALYSIS_CONFIG.checkSecure && !hasAttribute(raw, "secure")) {
    issues.push(`Missing Secure flag on cookie '${name}'`);
  }

  const sameSite = getSameSiteValue(raw);
  if (COOKIE_ANALYSIS_CONFIG.checkSameSite && !sameSite) {
    issues.push(`Missing SameSite attribute on cookie '${name}'`);
  }

  if (COOKIE_ANALYSIS_CONFIG.checkSameSiteNoneWithoutSecure
      && sameSite === "none"
      && !hasAttribute(raw, "secure")) {
    issues.push(`SameSite=None without Secure flag on cookie '${name}'`);
  }

  if (issues.length === 0) return null;
  return { name, url, issues, raw };
}

export interface CookieAnalysisResult {
  totalScanned: number;
  issues: CookieIssue[];
}

export function analyzeCookies(response: Response, url: string): CookieAnalysisResult {
  const setCookieHeaders = response.headers.getSetCookie();
  if (setCookieHeaders.length === 0) return { totalScanned: 0, issues: [] };

  const issues: CookieIssue[] = [];
  for (const raw of setCookieHeaders) {
    const issue = analyzeSingleCookie(raw, url);
    if (issue) issues.push(issue);
  }
  return { totalScanned: setCookieHeaders.length, issues };
}

import { HTTP_SCAN_CONFIG } from "../scan-config.js";
import { gradeAllHeaders, detectInfoLeakage } from "../headers.js";
import type { HeaderGrade } from "@penetragent/shared";

export interface PageSecurityResult {
  headerGrades: HeaderGrade[];
  infoLeakage: { header: string; value: string }[];
  contentIssues: string[];
}

export function checkSecurityIssues(
  response: Response,
  body: string,
): PageSecurityResult {
  const headerGrades = gradeAllHeaders(response.headers);
  const infoLeakage = detectInfoLeakage(response.headers);
  const contentIssues: string[] = [];

  if (HTTP_SCAN_CONFIG.mixedContentCheck && response.url.startsWith("https://")) {
    const httpResourceRegex = /src=["']http:\/\/[^"']+["']/gi;
    if (httpResourceRegex.test(body)) {
      contentIssues.push("Mixed content detected (HTTPS page with HTTP resources)");
    }
  }

  if (HTTP_SCAN_CONFIG.xssPatternCheck) {
    if (body.includes("<script>alert(") || body.includes("javascript:")) {
      contentIssues.push("Potential XSS pattern detected");
    }
  }

  return { headerGrades, infoLeakage, contentIssues };
}

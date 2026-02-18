import { HTTP_SCAN_CONFIG } from "../../config/scan-rules.js";
import { gradeAllHeaders, detectInfoLeakage } from "./headers.js";
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
    const { mixedContent } = HTTP_SCAN_CONFIG.contentCheckPatterns;
    mixedContent.lastIndex = 0;
    if (mixedContent.test(body)) {
      contentIssues.push("Mixed content detected (HTTPS page with HTTP resources)");
    }
  }

  if (HTTP_SCAN_CONFIG.xssPatternCheck) {
    const { xssIndicators } = HTTP_SCAN_CONFIG.contentCheckPatterns;
    if (xssIndicators.some((pattern) => body.includes(pattern))) {
      contentIssues.push("Potential XSS pattern detected");
    }
  }

  return { headerGrades, infoLeakage, contentIssues };
}

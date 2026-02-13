import { CRAWL_CONFIG } from "../scan-config.js";

export function checkSecurityIssues(
  response: Response,
  body: string,
): string[] {
  const issues: string[] = [];
  const { securityChecks } = CRAWL_CONFIG;

  for (const { header, finding } of securityChecks.requiredHeaders) {
    if (!response.headers.get(header)) {
      issues.push(finding);
    }
  }

  for (const { header, displayName } of securityChecks.infoDisclosureHeaders) {
    const value = response.headers.get(header);
    if (value) {
      issues.push(`${displayName} header disclosed: ${value}`);
    }
  }

  if (securityChecks.mixedContentCheck && response.url.startsWith("https://")) {
    const httpResourceRegex = /src=["']http:\/\/[^"']+["']/gi;
    if (httpResourceRegex.test(body)) {
      issues.push("Mixed content detected (HTTPS page with HTTP resources)");
    }
  }

  if (securityChecks.xssPatternCheck) {
    if (body.includes("<script>alert(") || body.includes("javascript:")) {
      issues.push("Potential XSS pattern detected");
    }
  }

  return issues;
}

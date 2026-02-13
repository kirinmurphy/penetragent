import fs from "node:fs";
import path from "node:path";
import { HEADERS_CONFIG, GRADE, type Grade } from "./scan-config.js";

export interface HeaderGrade {
  header: string;
  value: string | null;
  grade: Grade;
  reason: string;
}

export interface HeadersReport {
  url: string;
  redirectChain: string[];
  finalUrl: string;
  statusCode: number;
  headers: HeaderGrade[];
  infoLeakage: { header: string; value: string }[];
}

export interface HeadersSummary {
  good: number;
  weak: number;
  missing: number;
  infoLeakage: number;
  criticalFindings: string[];
}

export function gradeHsts(value: string | null): HeaderGrade {
  if (!value) {
    return {
      header: "Strict-Transport-Security",
      value: null,
      grade: GRADE.MISSING,
      reason: "Header not present",
    };
  }

  const maxAgeMatch = value.match(/max-age=(\d+)/i);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
  const hasSubDomains = /includeSubDomains/i.test(value);
  const oneYear = 31536000;

  if (maxAge >= oneYear && hasSubDomains) {
    return {
      header: "Strict-Transport-Security",
      value,
      grade: GRADE.GOOD,
      reason: `max-age=${maxAge} with includeSubDomains`,
    };
  }

  return {
    header: "Strict-Transport-Security",
    value,
    grade: GRADE.WEAK,
    reason:
      maxAge < oneYear
        ? `max-age=${maxAge} is less than 1 year (${oneYear})`
        : "Missing includeSubDomains",
  };
}

export function gradeCsp(value: string | null): HeaderGrade {
  if (!value) {
    return {
      header: "Content-Security-Policy",
      value: null,
      grade: GRADE.MISSING,
      reason: "Header not present",
    };
  }

  const hasUnsafeInline = /unsafe-inline/i.test(value);
  const hasUnsafeEval = /unsafe-eval/i.test(value);

  if (hasUnsafeInline || hasUnsafeEval) {
    const issues: string[] = [];
    if (hasUnsafeInline) issues.push("unsafe-inline");
    if (hasUnsafeEval) issues.push("unsafe-eval");
    return {
      header: "Content-Security-Policy",
      value,
      grade: GRADE.WEAK,
      reason: `Contains ${issues.join(", ")}`,
    };
  }

  return {
    header: "Content-Security-Policy",
    value,
    grade: GRADE.GOOD,
    reason: "Present without unsafe directives",
  };
}

export function gradeXContentTypeOptions(
  value: string | null,
): HeaderGrade {
  if (!value) {
    return {
      header: "X-Content-Type-Options",
      value: null,
      grade: GRADE.MISSING,
      reason: "Header not present",
    };
  }

  return {
    header: "X-Content-Type-Options",
    value,
    grade: value.toLowerCase() === "nosniff" ? GRADE.GOOD : GRADE.WEAK,
    reason:
      value.toLowerCase() === "nosniff"
        ? "Correctly set to nosniff"
        : `Unexpected value: ${value}`,
  };
}

export function gradeXFrameOptions(value: string | null): HeaderGrade {
  if (!value) {
    return {
      header: "X-Frame-Options",
      value: null,
      grade: GRADE.MISSING,
      reason: "Header not present",
    };
  }

  const upper = value.toUpperCase();
  if (upper === "DENY" || upper === "SAMEORIGIN") {
    return {
      header: "X-Frame-Options",
      value,
      grade: GRADE.GOOD,
      reason: `Set to ${upper}`,
    };
  }

  return {
    header: "X-Frame-Options",
    value,
    grade: GRADE.WEAK,
    reason: `Unexpected value: ${value}`,
  };
}

export function gradeReferrerPolicy(value: string | null): HeaderGrade {
  if (!value) {
    return {
      header: "Referrer-Policy",
      value: null,
      grade: GRADE.MISSING,
      reason: "Header not present",
    };
  }

  if (value.toLowerCase() === "unsafe-url") {
    return {
      header: "Referrer-Policy",
      value,
      grade: GRADE.WEAK,
      reason: "Set to unsafe-url which leaks full URL",
    };
  }

  return {
    header: "Referrer-Policy",
    value,
    grade: GRADE.GOOD,
    reason: `Set to ${value}`,
  };
}

export function gradePermissionsPolicy(value: string | null): HeaderGrade {
  if (!value) {
    return {
      header: "Permissions-Policy",
      value: null,
      grade: GRADE.MISSING,
      reason: "Header not present",
    };
  }

  return {
    header: "Permissions-Policy",
    value,
    grade: GRADE.GOOD,
    reason: "Present",
  };
}

export function detectInfoLeakage(
  headers: Headers,
): { header: string; value: string }[] {
  const leaks: { header: string; value: string }[] = [];
  const server = headers.get("server");
  if (server) leaks.push({ header: "Server", value: server });
  const poweredBy = headers.get("x-powered-by");
  if (poweredBy) leaks.push({ header: "X-Powered-By", value: poweredBy });
  return leaks;
}

export async function runHeadersScan(
  baseUrl: string,
  reportsDir: string,
  jobId: string,
): Promise<{ report: HeadersReport; summary: HeadersSummary }> {
  const redirectChain: string[] = [];
  let currentUrl = baseUrl;
  let response: Response;

  for (let i = 0; i < HEADERS_CONFIG.maxRedirects; i++) {
    response = await fetch(currentUrl, { redirect: "manual" });
    redirectChain.push(currentUrl);

    const location = response.headers.get("location");
    if (
      location &&
      response.status >= 300 &&
      response.status < 400
    ) {
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    break;
  }

  response = response!;

  const grades: HeaderGrade[] = [
    gradeHsts(response.headers.get("strict-transport-security")),
    gradeCsp(response.headers.get("content-security-policy")),
    gradeXContentTypeOptions(
      response.headers.get("x-content-type-options"),
    ),
    gradeXFrameOptions(response.headers.get("x-frame-options")),
    gradeReferrerPolicy(response.headers.get("referrer-policy")),
    gradePermissionsPolicy(response.headers.get("permissions-policy")),
  ];

  const infoLeakage = detectInfoLeakage(response.headers);

  const report: HeadersReport = {
    url: baseUrl,
    redirectChain,
    finalUrl: currentUrl,
    statusCode: response.status,
    headers: grades,
    infoLeakage,
  };

  const criticalFindings: string[] = [];
  const missingHeaders = grades.filter((g) => g.grade === GRADE.MISSING);

  for (const priorityHeader of HEADERS_CONFIG.priorityHeaders) {
    const match = missingHeaders.find((h) => h.header === priorityHeader);
    if (match) {
      criticalFindings.push(`Missing ${match.header.includes("Strict") ? "HSTS" : "CSP"} header`);
    }
  }

  for (const header of missingHeaders) {
    if (criticalFindings.length >= HEADERS_CONFIG.maxCriticalFindings) break;
    if (HEADERS_CONFIG.priorityHeaders.includes(header.header)) {
      continue;
    }
    criticalFindings.push(`Missing ${header.header} header`);
  }

  for (const leak of infoLeakage) {
    if (criticalFindings.length >= HEADERS_CONFIG.maxCriticalFindings) break;
    criticalFindings.push(`${leak.header} header disclosed: ${leak.value}`);
  }

  const summary: HeadersSummary = {
    good: grades.filter((g) => g.grade === GRADE.GOOD).length,
    weak: grades.filter((g) => g.grade === GRADE.WEAK).length,
    missing: grades.filter((g) => g.grade === GRADE.MISSING).length,
    infoLeakage: infoLeakage.length,
    criticalFindings,
  };

  const jobDir = path.join(reportsDir, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(
    path.join(jobDir, "headers.json"),
    JSON.stringify(report, null, 2),
  );

  return { report, summary };
}

import { GRADE } from "./scan-config.js";
import type { HeaderGrade } from "@penetragent/shared";

export type { HeaderGrade };

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

export function gradeAllHeaders(headers: Headers): HeaderGrade[] {
  return [
    gradeHsts(headers.get("strict-transport-security")),
    gradeCsp(headers.get("content-security-policy")),
    gradeXContentTypeOptions(headers.get("x-content-type-options")),
    gradeXFrameOptions(headers.get("x-frame-options")),
    gradeReferrerPolicy(headers.get("referrer-policy")),
    gradePermissionsPolicy(headers.get("permissions-policy")),
  ];
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

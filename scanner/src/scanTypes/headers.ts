import { GRADE, HEADER_RULES } from "./scan-config.js";
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

  const { minMaxAge, maxAgePattern, subDomainsPattern } = HEADER_RULES.hsts;
  const maxAgeMatch = value.match(maxAgePattern);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
  const hasSubDomains = subDomainsPattern.test(value);

  if (maxAge >= minMaxAge && hasSubDomains) {
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
      maxAge < minMaxAge
        ? `max-age=${maxAge} is less than 1 year (${minMaxAge})`
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

  const [unsafeInline, unsafeEval] = HEADER_RULES.csp.unsafeDirectives;
  const hasUnsafeInline = unsafeInline.test(value);
  const hasUnsafeEval = unsafeEval.test(value);

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

  const { expectedValue } = HEADER_RULES.xContentTypeOptions;
  const isCorrect = value.toLowerCase() === expectedValue;

  return {
    header: "X-Content-Type-Options",
    value,
    grade: isCorrect ? GRADE.GOOD : GRADE.WEAK,
    reason: isCorrect
      ? `Correctly set to ${expectedValue}`
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
  if (HEADER_RULES.xFrameOptions.validValues.includes(upper)) {
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

  if (HEADER_RULES.referrerPolicy.weakValues.includes(value.toLowerCase())) {
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
  for (const { key, display } of HEADER_RULES.infoLeakageHeaders) {
    const value = headers.get(key);
    if (value) leaks.push({ header: display, value });
  }
  return leaks;
}

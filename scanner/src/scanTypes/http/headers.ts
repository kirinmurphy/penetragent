import { GRADE, HEADER_RULES } from "../../config/scan-rules.js";
import type { HeaderGrade } from "@penetragent/shared";

export type { HeaderGrade };

export function gradeHsts(value: string | null): HeaderGrade {
  if (!value) {
    return { header: "Strict-Transport-Security", value: null, grade: GRADE.MISSING, reason: "Header not present" };
  }

  const { minMaxAge, maxAgePattern, subDomainsPattern } = HEADER_RULES.hsts;
  const maxAgeMatch = value.match(maxAgePattern);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
  const hasSubDomains = subDomainsPattern.test(value);
  const isStrong = maxAge >= minMaxAge && hasSubDomains;

  return {
    header: "Strict-Transport-Security",
    value,
    grade: isStrong ? GRADE.GOOD : GRADE.WEAK,
    reason: isStrong
      ? `max-age=${maxAge} with includeSubDomains`
      : maxAge < minMaxAge
        ? `max-age=${maxAge} is less than 1 year (${minMaxAge})`
        : "Missing includeSubDomains",
  };
}

export function gradeCsp(value: string | null): HeaderGrade {
  if (!value) {
    return { header: "Content-Security-Policy", value: null, grade: GRADE.MISSING, reason: "Header not present" };
  }

  const [unsafeInline, unsafeEval] = HEADER_RULES.csp.unsafeDirectives;
  const issues: string[] = [];
  if (unsafeInline.test(value)) issues.push("unsafe-inline");
  if (unsafeEval.test(value)) issues.push("unsafe-eval");

  return {
    header: "Content-Security-Policy",
    value,
    grade: issues.length > 0 ? GRADE.WEAK : GRADE.GOOD,
    reason: issues.length > 0 ? `Contains ${issues.join(", ")}` : "Present without unsafe directives",
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
    return { header: "X-Frame-Options", value: null, grade: GRADE.MISSING, reason: "Header not present" };
  }

  const upper = value.toUpperCase();
  const isValid = HEADER_RULES.xFrameOptions.validValues.includes(upper);

  return {
    header: "X-Frame-Options",
    value,
    grade: isValid ? GRADE.GOOD : GRADE.WEAK,
    reason: isValid ? `Set to ${upper}` : `Unexpected value: ${value}`,
  };
}

export function gradeReferrerPolicy(value: string | null): HeaderGrade {
  if (!value) {
    return { header: "Referrer-Policy", value: null, grade: GRADE.MISSING, reason: "Header not present" };
  }

  const isWeak = HEADER_RULES.referrerPolicy.weakValues.includes(value.toLowerCase());

  return {
    header: "Referrer-Policy",
    value,
    grade: isWeak ? GRADE.WEAK : GRADE.GOOD,
    reason: isWeak ? "Set to unsafe-url which leaks full URL" : `Set to ${value}`,
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

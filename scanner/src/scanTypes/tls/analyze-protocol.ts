import type { TlsProtocolSupport } from "@penetragent/shared";
import { GRADE } from "../../grading/grade-config.js";
import { TLS_SCAN_CONFIG } from "./tls-scan-config.js";

export function gradeProtocols(
  protocolResults: Map<string, boolean>,
): TlsProtocolSupport[] {
  const results: TlsProtocolSupport[] = [];

  for (const [protocol, supported] of protocolResults) {
    const isDeprecated = TLS_SCAN_CONFIG.deprecatedProtocols.includes(protocol);
    const isRequired = TLS_SCAN_CONFIG.requiredProtocols.includes(protocol);

    if (isDeprecated && supported) {
      results.push({
        protocol,
        supported,
        grade: GRADE.WEAK,
        reason: `${protocol} is deprecated and should be disabled`,
      });
      continue;
    }

    if (isRequired && !supported) {
      results.push({
        protocol,
        supported,
        grade: GRADE.MISSING,
        reason: `${protocol} is recommended but not supported`,
      });
      continue;
    }

    results.push({
      protocol,
      supported,
      grade: GRADE.GOOD,
      reason: supported
        ? `${protocol} is supported`
        : `${protocol} is correctly disabled`,
    });
  }

  return results;
}

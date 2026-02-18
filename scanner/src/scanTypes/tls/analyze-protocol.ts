import type { TlsProtocolSupport } from "@penetragent/shared";
import { GRADE, TLS_SCAN_CONFIG } from "../../config/scan-rules.js";

export function gradeProtocols(
  protocolResults: Map<string, boolean>,
): TlsProtocolSupport[] {
  return Array.from(protocolResults, ([protocol, supported]) => ({
    protocol,
    supported,
    ...gradeProtocol(protocol, supported),
  }));
}

function gradeProtocol(protocol: string, supported: boolean) {
  const isDeprecated = TLS_SCAN_CONFIG.deprecatedProtocols.includes(protocol);
  const isRequired = TLS_SCAN_CONFIG.requiredProtocols.includes(protocol);

  if (isDeprecated && supported) {
    return { grade: GRADE.WEAK, reason: `${protocol} is deprecated and should be disabled` };
  }
  if (isRequired && !supported) {
    return { grade: GRADE.MISSING, reason: `${protocol} is recommended but not supported` };
  }
  return {
    grade: GRADE.GOOD,
    reason: supported ? `${protocol} is supported` : `${protocol} is correctly disabled`,
  };
}

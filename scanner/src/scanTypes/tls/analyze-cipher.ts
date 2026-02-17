import type { TlsCipherInfo } from "@penetragent/shared";
import { GRADE } from "../../grading/grade-config.js";
import { TLS_SCAN_CONFIG } from "./tls-scan-config.js";

export function analyzeCipher(cipher: {
  name: string;
  standardName: string;
  version: string;
}): TlsCipherInfo {
  const isWeak = TLS_SCAN_CONFIG.weakCipherPatterns.some((p) => p.test(cipher.name) || p.test(cipher.standardName));
  const hasForwardSecrecy = TLS_SCAN_CONFIG.forwardSecrecyPatterns.some((p) => p.test(cipher.name) || p.test(cipher.standardName));

  if (isWeak) {
    return {
      ...cipher,
      grade: GRADE.MISSING,
      reason: "Weak cipher suite detected",
      hasForwardSecrecy,
    };
  }

  if (!hasForwardSecrecy) {
    return {
      ...cipher,
      grade: GRADE.WEAK,
      reason: "No forward secrecy support",
      hasForwardSecrecy,
    };
  }

  return {
    ...cipher,
    grade: GRADE.GOOD,
    reason: "Strong cipher with forward secrecy",
    hasForwardSecrecy,
  };
}

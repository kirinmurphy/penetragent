import type { TlsCipherInfo } from "@penetragent/shared";
import { GRADE, TLS_SCAN_CONFIG } from "../../config/scan-rules.js";

export function analyzeCipher(cipher: {
  name: string;
  standardName: string;
  version: string;
}): TlsCipherInfo {
  const isWeak = TLS_SCAN_CONFIG.weakCipherPatterns.some((p) => p.test(cipher.name) || p.test(cipher.standardName));
  const hasForwardSecrecy = TLS_SCAN_CONFIG.forwardSecrecyPatterns.some((p) => p.test(cipher.name) || p.test(cipher.standardName));

  const { grade, reason } = gradeCipher(isWeak, hasForwardSecrecy);
  return { ...cipher, grade, reason, hasForwardSecrecy };
}

function gradeCipher(isWeak: boolean, hasForwardSecrecy: boolean) {
  if (isWeak) return { grade: GRADE.MISSING, reason: "Weak cipher suite detected" };
  if (!hasForwardSecrecy) return { grade: GRADE.WEAK, reason: "No forward secrecy support" };
  return { grade: GRADE.GOOD, reason: "Strong cipher with forward secrecy" };
}

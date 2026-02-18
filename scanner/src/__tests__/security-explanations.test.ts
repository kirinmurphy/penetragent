import { describe, it, expect } from "vitest";
import {
  SECURITY_EXPLANATIONS,
  findExplanation,
} from "../config/security-explanations.js";

describe("SECURITY_EXPLANATIONS", () => {
  it("all entries have required fields", () => {
    for (const [key, entry] of Object.entries(SECURITY_EXPLANATIONS)) {
      expect(entry.what, `${key} missing 'what'`).toBeTruthy();
      expect(entry.why, `${key} missing 'why'`).toBeTruthy();
      expect(entry.remediation.generic, `${key} missing 'remediation.generic'`).toBeTruthy();
    }
  });

  it("has entries for all 6 security headers", () => {
    const headers = [
      "Strict-Transport-Security",
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ];
    for (const header of headers) {
      expect(SECURITY_EXPLANATIONS[header], `missing entry for ${header}`).toBeDefined();
    }
  });

  it("has entries for content findings", () => {
    expect(SECURITY_EXPLANATIONS["Mixed content detected"]).toBeDefined();
    expect(SECURITY_EXPLANATIONS["Potential XSS pattern detected"]).toBeDefined();
  });

  it("has entries for info leakage", () => {
    expect(SECURITY_EXPLANATIONS["Server header disclosed"]).toBeDefined();
    expect(SECURITY_EXPLANATIONS["X-Powered-By header disclosed"]).toBeDefined();
  });
});

describe("findExplanation", () => {
  it("returns exact match", () => {
    const result = findExplanation("Strict-Transport-Security");
    expect(result).toBeDefined();
    expect(result!.what).toContain("HSTS");
  });

  it("returns prefix match", () => {
    const result = findExplanation("Server header disclosed: Apache/2.4");
    expect(result).toBeDefined();
    expect(result!.what).toContain("Server response header");
  });

  it("matches case-insensitively", () => {
    const result = findExplanation("strict-transport-security");
    expect(result).toBeDefined();
    expect(result!.what).toContain("HSTS");
  });

  it("handles leading/trailing whitespace", () => {
    const result = findExplanation("  Referrer-Policy  ");
    expect(result).toBeDefined();
    expect(result!.what).toContain("referrer");
  });

  it("returns undefined for unknown key", () => {
    expect(findExplanation("totally-unknown-header")).toBeUndefined();
  });
});

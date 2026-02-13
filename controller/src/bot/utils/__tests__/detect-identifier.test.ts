import { describe, it, expect } from "vitest";
import { detectIdentifier } from "../detect-identifier.js";
import type { IdentifierResult } from "../detect-identifier.js";

const cases: { name: string; input: string; expected: IdentifierResult }[] = [
  { name: "UUID jobId", input: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", expected: { type: "jobId", value: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" } },
  { name: "uppercase UUID jobId", input: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890", expected: { type: "jobId", value: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890" } },
  { name: "domain without protocol", input: "example.com", expected: { type: "targetId", value: "example.com" } },
  { name: "domain with path", input: "example.com/admin", expected: { type: "targetId", value: "example.com/admin" } },
  { name: "https URL", input: "https://example.com", expected: { type: "url", value: "https://example.com" } },
  { name: "http URL", input: "http://example.com", expected: { type: "url", value: "http://example.com" } },
  { name: "URL with path", input: "https://example.com/admin", expected: { type: "url", value: "https://example.com/admin" } },
  { name: "mixed case URL", input: "HTTPS://EXAMPLE.COM", expected: { type: "url", value: "HTTPS://EXAMPLE.COM" } },
  { name: "non-UUID alphanumeric → targetId", input: "abc123def456", expected: { type: "targetId", value: "abc123def456" } },
  { name: "localhost", input: "localhost", expected: { type: "targetId", value: "localhost" } },
  { name: "localhost with port", input: "localhost:3000", expected: { type: "targetId", value: "localhost:3000" } },
  { name: "subdomain", input: "api.example.com", expected: { type: "targetId", value: "api.example.com" } },
  { name: "domain with port", input: "example.com:8080", expected: { type: "targetId", value: "example.com:8080" } },
  { name: "IP address", input: "192.168.1.1", expected: { type: "targetId", value: "192.168.1.1" } },
  { name: "empty string → unknown", input: "", expected: { type: "unknown", value: "" } },
  { name: "too short (< 3 chars) → unknown", input: "ab", expected: { type: "unknown", value: "ab" } },
];

describe("detectIdentifier", () => {
  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(detectIdentifier(input)).toEqual(expected);
    });
  }
});

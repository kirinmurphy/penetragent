export type IdentifierType = "jobId" | "targetId" | "url" | "unknown";

export interface IdentifierResult {
  type: IdentifierType;
  value: string;
}

export function detectIdentifier(input: string): IdentifierResult {
  if (!input || input.length < 3) {
    return { type: "unknown", value: input };
  }

  if (input.match(/^https?:\/\//i)) {
    return { type: "url", value: input };
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(input)) {
    return { type: "jobId", value: input };
  }

  return { type: "targetId", value: input };
}

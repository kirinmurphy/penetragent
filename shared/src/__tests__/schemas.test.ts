import { describe, it, expect } from "vitest";
import {
  ScanRequestSchema,
  JobPublicSchema,
  JobListQuerySchema,
} from "../schemas.js";

describe("ScanRequestSchema", () => {
  it("accepts a valid scan request", () => {
    const result = ScanRequestSchema.safeParse({
      targetId: "staging",
      scanType: "headers",
      requestedBy: "123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a url instead of targetId", () => {
    const result = ScanRequestSchema.safeParse({
      url: "https://example.com",
      scanType: "headers",
      requestedBy: "123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts both targetId and url", () => {
    const result = ScanRequestSchema.safeParse({
      targetId: "staging",
      url: "https://example.com",
      scanType: "headers",
      requestedBy: "123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when neither targetId nor url provided", () => {
    const result = ScanRequestSchema.safeParse({
      scanType: "headers",
      requestedBy: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty targetId without url", () => {
    const result = ScanRequestSchema.safeParse({
      targetId: "",
      scanType: "headers",
      requestedBy: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid url", () => {
    const result = ScanRequestSchema.safeParse({
      url: "not-a-url",
      scanType: "headers",
      requestedBy: "123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts request without scanType", () => {
    const result = ScanRequestSchema.safeParse({
      targetId: "staging",
      requestedBy: "123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing requestedBy", () => {
    const result = ScanRequestSchema.safeParse({
      targetId: "staging",
      scanType: "headers",
    });
    expect(result.success).toBe(false);
  });
});

describe("JobPublicSchema", () => {
  const validJob = {
    jobId: "550e8400-e29b-41d4-a716-446655440000",
    targetId: "staging",
    scanType: "headers",
    status: "QUEUED",
    requestedBy: "123",
    errorCode: null,
    errorMessage: null,
    summaryJson: null,
    resolvedIpsJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
  };

  it("accepts a valid QUEUED job", () => {
    const result = JobPublicSchema.safeParse(validJob);
    expect(result.success).toBe(true);
  });

  it("accepts a valid SUCCEEDED job with summary", () => {
    const result = JobPublicSchema.safeParse({
      ...validJob,
      status: "SUCCEEDED",
      summaryJson: { good: 3, weak: 1, missing: 2 },
      startedAt: "2024-01-01T00:00:01.000Z",
      finishedAt: "2024-01-01T00:00:05.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = JobPublicSchema.safeParse({
      ...validJob,
      status: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID jobId", () => {
    const result = JobPublicSchema.safeParse({
      ...validJob,
      jobId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("JobListQuerySchema", () => {
  it("applies defaults", () => {
    const result = JobListQuerySchema.parse({});
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it("coerces string numbers", () => {
    const result = JobListQuerySchema.parse({ limit: "5", offset: "10" });
    expect(result.limit).toBe(5);
    expect(result.offset).toBe(10);
  });

  it("rejects limit > 100", () => {
    const result = JobListQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects negative offset", () => {
    const result = JobListQuerySchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });
});

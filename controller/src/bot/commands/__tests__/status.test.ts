import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleStatus } from "../status.js";
import { JobStatus } from "@penetragent/shared";
import type { JobPublic } from "@penetragent/shared";
import type { ScannerClient } from "../../../scanner-client/client.js";
import type { Context } from "grammy";

describe("handleStatus", () => {
  let mockClient: ScannerClient;
  let mockContext: Context;

  beforeEach(() => {
    mockClient = {
      getJob: vi.fn(),
    } as unknown as ScannerClient;

    mockContext = {
      reply: vi.fn(),
      api: {
        sendChatAction: vi.fn(),
      },
      chat: {
        id: 123456789,
      },
    } as unknown as Context;
  });

  it("should format flat summary objects properly", async () => {
    const job: JobPublic = {
      jobId: "test-job-123",
      targetId: "example.com",
      scanType: "headers",
      status: JobStatus.SUCCEEDED,
      requestedBy: "123456789",
      errorCode: null,
      errorMessage: null,
      summaryJson: {
        good: 3,
        weak: 1,
        missing: 2,
        infoLeakage: 1,
      },
      resolvedIpsJson: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:01:00Z",
      startedAt: "2024-01-01T00:00:00Z",
      finishedAt: "2024-01-01T00:01:00Z",
    };

    vi.mocked(mockClient.getJob).mockResolvedValue(job);

    await handleStatus({ ctx: mockContext, args: ["test-job-123"], client: mockClient });

    expect(mockContext.reply).toHaveBeenCalledOnce();
    const message = vi.mocked(mockContext.reply).mock.calls[0][0] as string;

    expect(message).toContain("good: 3");
    expect(message).toContain("weak: 1");
    expect(message).toContain("missing: 2");
    expect(message).toContain("infoLeakage: 1");
  });

  it("should format nested summary objects properly", async () => {
    const job: JobPublic = {
      jobId: "test-job-456",
      targetId: "example.com",
      scanType: "all",
      status: JobStatus.SUCCEEDED,
      requestedBy: "123456789",
      errorCode: null,
      errorMessage: null,
      summaryJson: {
        headers: { good: 3, weak: 1, missing: 2 },
        crawl: { pagesScanned: 15, issuesFound: 8 },
      },
      resolvedIpsJson: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:01:00Z",
      startedAt: "2024-01-01T00:00:00Z",
      finishedAt: "2024-01-01T00:01:00Z",
    };

    vi.mocked(mockClient.getJob).mockResolvedValue(job);

    await handleStatus({ ctx: mockContext, args: ["test-job-456"], client: mockClient });

    expect(mockContext.reply).toHaveBeenCalledOnce();
    const message = vi.mocked(mockContext.reply).mock.calls[0][0] as string;

    expect(message).toContain("headers:");
    expect(message).toContain("crawl:");
    expect(message).toMatch(/good.*3/);
    expect(message).toMatch(/pagesScanned.*15/);
  });

  it("should return usage message when no jobId provided", async () => {
    await handleStatus({ ctx: mockContext, args: [], client: mockClient });

    expect(mockContext.reply).toHaveBeenCalledWith("Usage: status <jobId>");
    expect(mockClient.getJob).not.toHaveBeenCalled();
  });

  it("should handle job not found errors", async () => {
    vi.mocked(mockClient.getJob).mockRejectedValue(
      new Error("Job not found"),
    );

    await handleStatus({ ctx: mockContext, args: ["nonexistent-job"], client: mockClient });

    expect(mockContext.reply).toHaveBeenCalledWith(
      "Could not find job: nonexistent-job",
    );
  });

  it("should not show summary for non-terminal statuses", async () => {
    const job: JobPublic = {
      jobId: "test-job-running",
      targetId: "example.com",
      scanType: "headers",
      status: JobStatus.RUNNING,
      requestedBy: "123456789",
      errorCode: null,
      errorMessage: null,
      summaryJson: null,
      resolvedIpsJson: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:30Z",
      startedAt: "2024-01-01T00:00:00Z",
      finishedAt: null,
    };

    vi.mocked(mockClient.getJob).mockResolvedValue(job);

    await handleStatus({ ctx: mockContext, args: ["test-job-running"], client: mockClient });

    expect(mockContext.reply).toHaveBeenCalledOnce();
    const message = vi.mocked(mockContext.reply).mock.calls[0][0] as string;

    expect(message).toContain("Status: RUNNING");
    expect(message).not.toContain("Summary:");
  });
});

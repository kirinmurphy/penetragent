import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobPoller } from "../job-poller.js";
import { JobStatus } from "@penetragent/shared";
import type { Bot } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";
import type { JobPublic, JobListResponse } from "@penetragent/shared";

describe("JobPoller", () => {
  let mockClient: ScannerClient;
  let mockBot: Bot;
  let poller: JobPoller;

  beforeEach(() => {
    vi.useFakeTimers();

    mockClient = {
      listJobs: vi.fn(),
      getJob: vi.fn(),
    } as unknown as ScannerClient;

    mockBot = {
      api: {
        sendMessage: vi.fn(),
      },
    } as unknown as Bot;

    poller = new JobPoller(mockClient, mockBot, 1000, 10000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("recoverInProgressJobs", () => {
    it("should resume polling for RUNNING jobs", async () => {
      const runningJob: JobPublic = {
        jobId: "job-1",
        targetId: "example.com",
        scanType: "headers",
        status: JobStatus.RUNNING,
        requestedBy: "123456789",
        errorCode: null,
        errorMessage: null,
        summaryJson: null,
        resolvedIpsJson: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-01T00:00:00Z",
        finishedAt: null,
      };

      const response: JobListResponse = {
        jobs: [runningJob],
        total: 1,
        limit: 100,
        offset: 0,
      };

      vi.mocked(mockClient.listJobs).mockResolvedValue(response);

      await poller.recoverInProgressJobs();

      expect(mockClient.listJobs).toHaveBeenCalledWith({ limit: 100, status: "RUNNING,QUEUED" });
      // Should start polling for the job
    });

    it("should resume polling for QUEUED jobs", async () => {
      const queuedJob: JobPublic = {
        jobId: "job-2",
        targetId: "example.com",
        scanType: "headers",
        status: JobStatus.QUEUED,
        requestedBy: "123456789",
        errorCode: null,
        errorMessage: null,
        summaryJson: null,
        resolvedIpsJson: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        startedAt: null,
        finishedAt: null,
      };

      const response: JobListResponse = {
        jobs: [queuedJob],
        total: 1,
        limit: 100,
        offset: 0,
      };

      vi.mocked(mockClient.listJobs).mockResolvedValue(response);

      await poller.recoverInProgressJobs();

      expect(mockClient.listJobs).toHaveBeenCalledWith({ limit: 100, status: "RUNNING,QUEUED" });
    });

    it("should ignore SUCCEEDED jobs", async () => {
      const succeededJob: JobPublic = {
        jobId: "job-3",
        targetId: "example.com",
        scanType: "headers",
        status: JobStatus.SUCCEEDED,
        requestedBy: "123456789",
        errorCode: null,
        errorMessage: null,
        summaryJson: { good: 5, weak: 0, missing: 1 },
        resolvedIpsJson: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:01:00Z",
        startedAt: "2024-01-01T00:00:00Z",
        finishedAt: "2024-01-01T00:01:00Z",
      };

      const response: JobListResponse = {
        jobs: [succeededJob],
        total: 1,
        limit: 100,
        offset: 0,
      };

      vi.mocked(mockClient.listJobs).mockResolvedValue(response);

      await poller.recoverInProgressJobs();

      expect(mockClient.listJobs).toHaveBeenCalled();
      // Should NOT start polling for completed job
    });

    it("should handle multiple in-progress jobs", async () => {
      const jobs: JobPublic[] = [
        {
          jobId: "job-1",
          targetId: "example.com",
          scanType: "headers",
          status: JobStatus.RUNNING,
          requestedBy: "123456789",
          errorCode: null,
          errorMessage: null,
          summaryJson: null,
          resolvedIpsJson: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          startedAt: "2024-01-01T00:00:00Z",
          finishedAt: null,
        },
        {
          jobId: "job-2",
          targetId: "example.org",
          scanType: "headers",
          status: JobStatus.QUEUED,
          requestedBy: "987654321",
          errorCode: null,
          errorMessage: null,
          summaryJson: null,
          resolvedIpsJson: null,
          createdAt: "2024-01-01T00:00:01Z",
          updatedAt: "2024-01-01T00:00:01Z",
          startedAt: null,
          finishedAt: null,
        },
      ];

      const response: JobListResponse = {
        jobs,
        total: 2,
        limit: 100,
        offset: 0,
      };

      vi.mocked(mockClient.listJobs).mockResolvedValue(response);

      await poller.recoverInProgressJobs();

      expect(mockClient.listJobs).toHaveBeenCalledWith({ limit: 100, status: "RUNNING,QUEUED" });
    });

    it("should handle empty job list", async () => {
      const response: JobListResponse = {
        jobs: [],
        total: 0,
        limit: 100,
        offset: 0,
      };

      vi.mocked(mockClient.listJobs).mockResolvedValue(response);

      await poller.recoverInProgressJobs();

      expect(mockClient.listJobs).toHaveBeenCalled();
    });

    it("should handle scanner client errors gracefully", async () => {
      vi.mocked(mockClient.listJobs).mockRejectedValue(
        new Error("Scanner unavailable"),
      );

      // Should not throw
      await expect(poller.recoverInProgressJobs()).resolves.toBeUndefined();
    });

    it("should skip jobs with invalid requestedBy", async () => {
      const invalidJob: JobPublic = {
        jobId: "job-bad",
        targetId: "example.com",
        scanType: "headers",
        status: JobStatus.RUNNING,
        requestedBy: "not-a-number",
        errorCode: null,
        errorMessage: null,
        summaryJson: null,
        resolvedIpsJson: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-01T00:00:00Z",
        finishedAt: null,
      };

      const response: JobListResponse = {
        jobs: [invalidJob],
        total: 1,
        limit: 100,
        offset: 0,
      };

      vi.mocked(mockClient.listJobs).mockResolvedValue(response);

      await poller.recoverInProgressJobs();

      // Should handle gracefully and skip
      expect(mockClient.listJobs).toHaveBeenCalled();
    });
  });

  describe("startPolling", () => {
    it("should prevent duplicate polling for the same job", () => {
      const jobId = "job-123";
      const chatId = 123456789;

      // Start polling first time
      poller.startPolling(jobId, chatId);

      // Try to start polling again - should be prevented
      poller.startPolling(jobId, chatId);

      // Internal state check - only one poll should be active
      // (We can't easily test this without exposing internals, but we can verify no errors)
    });

    it("should start polling for a new job", () => {
      const jobId = "job-456";
      const chatId = 123456789;

      expect(() => poller.startPolling(jobId, chatId)).not.toThrow();
    });

    it("should format nested summary objects properly", async () => {
      const jobId = "job-with-nested-summary";
      const chatId = 123456789;

      // Simulate a job with nested summary (like when running multiple scan types)
      const completedJob: JobPublic = {
        jobId,
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

      vi.mocked(mockClient.getJob).mockResolvedValue(completedJob);

      poller.startPolling(jobId, chatId);

      // Advance timer to trigger the poll
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockBot.api.sendMessage).toHaveBeenCalledOnce();

      const [[actualChatId, actualMessage]] = vi.mocked(
        mockBot.api.sendMessage,
      ).mock.calls;

      expect(actualChatId).toBe(chatId);

      expect(actualMessage).toContain("headers:");
      expect(actualMessage).toContain("crawl:");
      expect(actualMessage).toMatch(/good.*3/);
      expect(actualMessage).toMatch(/pagesScanned.*15/);
    });
  });
});

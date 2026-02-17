import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createJobPoller, type JobPoller } from "../job-poller.js";
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
        sendDocument: vi.fn(),
      },
    } as unknown as Bot;

    poller = createJobPoller({
      client: mockClient,
      bot: mockBot,
      pollIntervalMs: 1000,
      pollTimeoutMs: 10000,
      scannerBaseUrl: "http://scanner:8080",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("recoverInProgressJobs", () => {
    it("should resume polling for RUNNING jobs", async () => {
      const runningJob: JobPublic = {
        jobId: "job-1",
        targetId: "example.com",
        scanType: "http",
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
    });

    it("should resume polling for QUEUED jobs", async () => {
      const queuedJob: JobPublic = {
        jobId: "job-2",
        targetId: "example.com",
        scanType: "http",
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
        scanType: "http",
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
    });

    it("should handle multiple in-progress jobs", async () => {
      const jobs: JobPublic[] = [
        {
          jobId: "job-1",
          targetId: "example.com",
          scanType: "http",
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
          scanType: "http",
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

      await expect(poller.recoverInProgressJobs()).resolves.toBeUndefined();
    });

    it("should skip jobs with invalid requestedBy", async () => {
      const invalidJob: JobPublic = {
        jobId: "job-bad",
        targetId: "example.com",
        scanType: "http",
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

      expect(mockClient.listJobs).toHaveBeenCalled();
    });
  });

  describe("startPolling", () => {
    it("should prevent duplicate polling for the same job", () => {
      const jobId = "job-123";
      const chatId = 123456789;

      poller.startPolling(jobId, chatId);
      poller.startPolling(jobId, chatId);
    });

    it("should start polling for a new job", () => {
      const jobId = "job-456";
      const chatId = 123456789;

      expect(() => poller.startPolling(jobId, chatId)).not.toThrow();
    });

    it("should send document with summary as caption for succeeded jobs", async () => {
      const jobId = "job-with-nested-summary";
      const chatId = 123456789;

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
          http: { pagesScanned: 15, issuesFound: 8 },
        },
        resolvedIpsJson: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:01:00Z",
        startedAt: "2024-01-01T00:00:00Z",
        finishedAt: "2024-01-01T00:01:00Z",
      };

      vi.mocked(mockClient.getJob).mockResolvedValue(completedJob);

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>report</html>"),
      }));

      poller.startPolling(jobId, chatId);
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockBot.api.sendDocument).toHaveBeenCalledOnce();
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();

      const [[actualChatId, , options]] = vi.mocked(
        mockBot.api.sendDocument,
      ).mock.calls;

      expect(actualChatId).toBe(chatId);
      expect(options!.caption).toContain("headers:");
      expect(options!.caption).toContain("http:");
      expect(options!.caption).toContain("Good: 3");
      expect(options!.caption).toContain("Pages Scanned: 15");
    });

    it("should use targetId and date in the report filename", async () => {
      const jobId = "job-filename-test";
      const chatId = 123456789;

      const completedJob: JobPublic = {
        jobId,
        targetId: "example.com",
        scanType: "http",
        status: JobStatus.SUCCEEDED,
        requestedBy: "123456789",
        errorCode: null,
        errorMessage: null,
        summaryJson: { good: 5 },
        resolvedIpsJson: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:01:00Z",
        startedAt: "2024-01-01T00:00:00Z",
        finishedAt: "2024-03-15T10:30:00Z",
      };

      vi.mocked(mockClient.getJob).mockResolvedValue(completedJob);

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>report</html>"),
      }));

      poller.startPolling(jobId, chatId);
      await vi.advanceTimersByTimeAsync(1000);

      const [[, inputFile]] = vi.mocked(mockBot.api.sendDocument).mock.calls;
      expect(inputFile).toHaveProperty("filename", "example.com-2024-03-15.html");
    });

    it("should fall back to sendMessage when report fetch fails", async () => {
      const jobId = "job-report-fail";
      const chatId = 123456789;

      const completedJob: JobPublic = {
        jobId,
        targetId: "example.com",
        scanType: "http",
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

      vi.mocked(mockClient.getJob).mockResolvedValue(completedJob);

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }));

      poller.startPolling(jobId, chatId);
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockBot.api.sendMessage).toHaveBeenCalledOnce();
      expect(mockBot.api.sendDocument).not.toHaveBeenCalled();
    });
  });
});

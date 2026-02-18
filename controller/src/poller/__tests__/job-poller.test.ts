import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createJobPoller, type JobPoller } from "../job-poller.js";
import { JobStatus } from "@penetragent/shared";
import type { Bot } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";
import { makeJob, makeJobListResponse } from "../../__tests__/fixtures.js";

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
    const recoverCases = [
      {
        name: "resumes polling for a RUNNING job",
        jobs: [makeJob({ jobId: "job-1", status: JobStatus.RUNNING, startedAt: "2024-01-01T00:00:00Z" })],
      },
      {
        name: "resumes polling for a QUEUED job",
        jobs: [makeJob({ jobId: "job-2", status: JobStatus.QUEUED })],
      },
      {
        name: "passes SUCCEEDED jobs through (filtered by server)",
        jobs: [makeJob({ jobId: "job-3", status: JobStatus.SUCCEEDED, summaryJson: { good: 5 }, finishedAt: "2024-01-01T00:01:00Z" })],
      },
      {
        name: "handles multiple in-progress jobs",
        jobs: [
          makeJob({ jobId: "job-1", status: JobStatus.RUNNING, startedAt: "2024-01-01T00:00:00Z" }),
          makeJob({ jobId: "job-2", targetId: "example.org", status: JobStatus.QUEUED, requestedBy: "987654321" }),
        ],
      },
      {
        name: "handles empty job list",
        jobs: [],
      },
    ];

    for (const { name, jobs } of recoverCases) {
      it(name, async () => {
        vi.mocked(mockClient.listJobs).mockResolvedValue(makeJobListResponse(jobs));

        await poller.recoverInProgressJobs();

        expect(mockClient.listJobs).toHaveBeenCalledWith({ limit: 100, status: "RUNNING,QUEUED" });
      });
    }

    it("handles scanner client errors gracefully", async () => {
      vi.mocked(mockClient.listJobs).mockRejectedValue(
        new Error("Scanner unavailable"),
      );

      await expect(poller.recoverInProgressJobs()).resolves.toBeUndefined();
    });

    it("skips jobs with invalid requestedBy", async () => {
      vi.mocked(mockClient.listJobs).mockResolvedValue(
        makeJobListResponse([makeJob({ jobId: "job-bad", status: JobStatus.RUNNING, requestedBy: "not-a-number" })]),
      );

      await poller.recoverInProgressJobs();

      expect(mockClient.listJobs).toHaveBeenCalled();
    });
  });

  describe("startPolling", () => {
    it("prevents duplicate polling for the same job", () => {
      poller.startPolling("job-123", 123456789);
      poller.startPolling("job-123", 123456789);
    });

    it("starts polling for a new job", () => {
      expect(() => poller.startPolling("job-456", 123456789)).not.toThrow();
    });

    it("sends document with summary as caption for succeeded jobs", async () => {
      const jobId = "job-with-nested-summary";
      const chatId = 123456789;

      vi.mocked(mockClient.getJob).mockResolvedValue(makeJob({
        jobId,
        scanType: "all",
        status: JobStatus.SUCCEEDED,
        summaryJson: {
          headers: { good: 3, weak: 1, missing: 2 },
          http: { pagesScanned: 15, issuesFound: 8 },
        },
        finishedAt: "2024-01-01T00:01:00Z",
      }));

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
      expect(options!.caption).toContain("HTTP Analysis:");
      expect(options!.caption).toContain("Good: 3");
      expect(options!.caption).toContain("Pages Scanned: 15");
    });

    it("uses targetId and date in the report filename", async () => {
      const jobId = "job-filename-test";
      const chatId = 123456789;

      vi.mocked(mockClient.getJob).mockResolvedValue(makeJob({
        jobId,
        status: JobStatus.SUCCEEDED,
        summaryJson: { good: 5 },
        finishedAt: "2024-03-15T10:30:00Z",
      }));

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>report</html>"),
      }));

      poller.startPolling(jobId, chatId);
      await vi.advanceTimersByTimeAsync(1000);

      const [[, inputFile]] = vi.mocked(mockBot.api.sendDocument).mock.calls;
      expect(inputFile).toHaveProperty("filename", "example.com-2024-03-15.html");
    });

    it("falls back to sendMessage when report fetch fails", async () => {
      const jobId = "job-report-fail";
      const chatId = 123456789;

      vi.mocked(mockClient.getJob).mockResolvedValue(makeJob({
        jobId,
        status: JobStatus.SUCCEEDED,
        summaryJson: { good: 5, weak: 0, missing: 1 },
        finishedAt: "2024-01-01T00:01:00Z",
      }));

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

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ScannerClient,
  RateLimitedError,
  ScannerUnavailableError,
  ScannerApiError,
} from "../client.js";
import { JobStatus } from "@penetragent/shared";
import type { JobPublic } from "@penetragent/shared";

describe("ScannerClient", () => {
  let client: ScannerClient;
  const baseUrl = "http://scanner:8080";

  beforeEach(() => {
    client = new ScannerClient(baseUrl);
    vi.resetAllMocks();
  });

  describe("health", () => {
    it("should return health status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const result = await client.health();

      expect(result).toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledWith(`${baseUrl}/health`, undefined);
    });

    it("should throw ScannerUnavailableError on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(client.health()).rejects.toThrow(ScannerUnavailableError);
    });
  });

  describe("listTargets", () => {
    it("should return list of targets", async () => {
      const mockTargets = [
        { id: "example.com", base_url: "https://example.com", description: null },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ targets: mockTargets }),
      });

      const result = await client.listTargets();

      expect(result).toEqual(mockTargets);
    });

    it("should throw ScannerApiError on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(client.listTargets()).rejects.toThrow(ScannerApiError);
    });
  });

  describe("createScan", () => {
    it("should create scan with URL", async () => {
      const mockJob: JobPublic = {
        jobId: "job-123",
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockJob,
      });

      const result = await client.createScan(
        "https://example.com",
        "123456789",
        "headers",
      );

      expect(result).toEqual(mockJob);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/scan`,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "https://example.com",
            requestedBy: "123456789",
            scanType: "headers",
          }),
        }),
      );
    });

    it("should create scan with targetId", async () => {
      const mockJob: JobPublic = {
        jobId: "job-456",
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockJob,
      });

      const result = await client.createScan("example.com", "123456789");

      expect(result).toEqual(mockJob);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/scan`,
        expect.objectContaining({
          body: JSON.stringify({
            targetId: "example.com",
            requestedBy: "123456789",
          }),
        }),
      );
    });

    it("should throw RateLimitedError on 429 response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ runningJobId: "job-running" }),
      });

      await expect(
        client.createScan("https://example.com", "123456789"),
      ).rejects.toThrow(RateLimitedError);

      try {
        await client.createScan("https://example.com", "123456789");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitedError);
        expect((error as RateLimitedError).runningJobId).toBe("job-running");
      }
    });

    it("should throw ScannerApiError on other error responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      await expect(
        client.createScan("https://example.com", "123456789"),
      ).rejects.toThrow(ScannerApiError);
    });
  });

  describe("getJob", () => {
    it("should return job details", async () => {
      const mockJob: JobPublic = {
        jobId: "job-789",
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockJob,
      });

      const result = await client.getJob("job-789");

      expect(result).toEqual(mockJob);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/jobs/job-789`,
        undefined,
      );
    });

    it("should throw ScannerApiError on 404", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      });

      await expect(client.getJob("job-nonexistent")).rejects.toThrow(
        ScannerApiError,
      );
    });
  });

  describe("listJobs", () => {
    it("should return paginated job list", async () => {
      const mockResponse = {
        jobs: [],
        total: 0,
        limit: 10,
        offset: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listJobs({ limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/jobs?limit=10&offset=0`,
        undefined,
      );
    });

    it("should use default parameters", async () => {
      const mockResponse = {
        jobs: [],
        total: 0,
        limit: 10,
        offset: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await client.listJobs();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/jobs?limit=10&offset=0`,
        undefined,
      );
    });

    it("should throw ScannerApiError on error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Server Error",
      });

      await expect(client.listJobs()).rejects.toThrow(ScannerApiError);
    });
  });

  describe("error handling", () => {
    it("should wrap network errors in ScannerUnavailableError", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(client.health()).rejects.toThrow(ScannerUnavailableError);
      await expect(client.health()).rejects.toThrow(/Connection refused/);
    });

    it("should include base URL in error message", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("timeout"));

      try {
        await client.health();
      } catch (error) {
        expect((error as Error).message).toContain(baseUrl);
      }
    });
  });
});

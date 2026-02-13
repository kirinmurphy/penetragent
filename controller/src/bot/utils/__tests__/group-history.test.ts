import { describe, it, expect } from "vitest";
import { groupJobsByTarget } from "../group-history.js";

describe("groupJobsByTarget", () => {
  it("should group multiple jobs for same target into one entry", () => {
    const jobs = [
      {
        jobId: "job1",
        targetId: "example.com",
        targetUrl: "https://example.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-12 13:49:30",
      },
      {
        jobId: "job2",
        targetId: "example.com",
        targetUrl: "https://example.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-11 10:30:00",
      },
      {
        jobId: "job3",
        targetId: "example.com",
        targetUrl: "https://example.com",
        status: "FAILED",
        createdAt: "2026-02-10 08:15:00",
      },
    ];

    const grouped = groupJobsByTarget(jobs);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toEqual({
      targetId: "example.com",
      targetUrl: "https://example.com",
      latestJobId: "job1",
      latestStatus: "SUCCEEDED",
      latestDate: "2026-02-12 13:49:30",
      totalScans: 3,
    });
  });

  it("should create separate entries for different targets", () => {
    const jobs = [
      {
        jobId: "job1",
        targetId: "example.com",
        targetUrl: "https://example.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-12 13:49:30",
      },
      {
        jobId: "job2",
        targetId: "test.com",
        targetUrl: "https://test.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-11 10:30:00",
      },
    ];

    const grouped = groupJobsByTarget(jobs);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].targetId).toBe("example.com");
    expect(grouped[0].totalScans).toBe(1);
    expect(grouped[1].targetId).toBe("test.com");
    expect(grouped[1].totalScans).toBe(1);
  });

  it("should sort by most recent date first", () => {
    const jobs = [
      {
        jobId: "job1",
        targetId: "old.com",
        targetUrl: "https://old.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-10 08:00:00",
      },
      {
        jobId: "job2",
        targetId: "new.com",
        targetUrl: "https://new.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-12 13:49:30",
      },
      {
        jobId: "job3",
        targetId: "middle.com",
        targetUrl: "https://middle.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-11 10:30:00",
      },
    ];

    const grouped = groupJobsByTarget(jobs);

    expect(grouped[0].targetId).toBe("new.com");
    expect(grouped[1].targetId).toBe("middle.com");
    expect(grouped[2].targetId).toBe("old.com");
  });

  it("should show most recent status for target with multiple scans", () => {
    const jobs = [
      {
        jobId: "job1",
        targetId: "example.com",
        targetUrl: "https://example.com",
        status: "FAILED",
        createdAt: "2026-02-12 13:49:30",
      },
      {
        jobId: "job2",
        targetId: "example.com",
        targetUrl: "https://example.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-11 10:30:00",
      },
    ];

    const grouped = groupJobsByTarget(jobs);

    expect(grouped[0].latestStatus).toBe("FAILED");
    expect(grouped[0].latestJobId).toBe("job1");
  });

  it("should handle empty array", () => {
    const jobs: { jobId: string; targetId: string; targetUrl: string; status: string; createdAt: string }[] = [];

    const grouped = groupJobsByTarget(jobs);

    expect(grouped).toEqual([]);
  });

  it("should handle targets with different URL paths for same domain", () => {
    const jobs = [
      {
        jobId: "job1",
        targetId: "example.com",
        targetUrl: "https://example.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-12 13:49:30",
      },
      {
        jobId: "job2",
        targetId: "example.com/admin",
        targetUrl: "https://example.com/admin",
        status: "SUCCEEDED",
        createdAt: "2026-02-11 10:30:00",
      },
    ];

    const grouped = groupJobsByTarget(jobs);

    // These should be separate entries because targetId is different
    expect(grouped).toHaveLength(2);
    expect(grouped[0].targetId).toBe("example.com");
    expect(grouped[1].targetId).toBe("example.com/admin");
  });

  it("should limit results when limit parameter is provided", () => {
    const jobs = [
      {
        jobId: "job1",
        targetId: "site1.com",
        targetUrl: "https://site1.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-12 13:49:30",
      },
      {
        jobId: "job2",
        targetId: "site2.com",
        targetUrl: "https://site2.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-11 10:30:00",
      },
      {
        jobId: "job3",
        targetId: "site3.com",
        targetUrl: "https://site3.com",
        status: "SUCCEEDED",
        createdAt: "2026-02-10 08:00:00",
      },
    ];

    const grouped = groupJobsByTarget(jobs, 2);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].targetId).toBe("site1.com");
    expect(grouped[1].targetId).toBe("site2.com");
  });
});

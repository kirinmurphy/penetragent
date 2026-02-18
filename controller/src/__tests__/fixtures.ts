import { JobStatus } from "@penetragent/shared";
import type { JobPublic, JobListResponse } from "@penetragent/shared";

export function makeJob(overrides?: Partial<JobPublic>): JobPublic {
  return {
    jobId: "job-1",
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
    ...overrides,
  };
}

export function makeJobListResponse(
  jobs: JobPublic[],
  overrides?: Partial<Omit<JobListResponse, "jobs">>,
): JobListResponse {
  return {
    jobs,
    total: jobs.length,
    limit: 100,
    offset: 0,
    ...overrides,
  };
}

export const JobStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  FAILED_ON_RESTART: "FAILED_ON_RESTART",
} as const;

export type JobStatusType = (typeof JobStatus)[keyof typeof JobStatus];

export const TERMINAL_STATUSES = new Set<JobStatusType>([
  JobStatus.SUCCEEDED,
  JobStatus.FAILED,
  JobStatus.FAILED_ON_RESTART,
]);

export const SCAN_TYPES = {
  headers: { name: "HTTP Security Headers", description: "Checks HTTP security headers and grades them" },
  crawl: { name: "Site Crawl", description: "Crawls the site and checks each page for security issues (no attacks)" },
} as const;

export type ScanTypeId = keyof typeof SCAN_TYPES;

export const ErrorCode = {
  RATE_LIMITED: "RATE_LIMITED",
  TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
  INVALID_SCAN_TYPE: "INVALID_SCAN_TYPE",
  JOB_NOT_FOUND: "JOB_NOT_FOUND",
  PRIVATE_RANGE_RESTRICTED: "PRIVATE_RANGE_RESTRICTED",
  DNS_NO_RESULTS: "DNS_NO_RESULTS",
  DNS_RESOLUTION_FAILED: "DNS_RESOLUTION_FAILED",
  SCAN_EXECUTION_FAILED: "SCAN_EXECUTION_FAILED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

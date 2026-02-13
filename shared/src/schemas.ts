import { z } from "zod";
import { JobStatus } from "./types.js";

export const ScanRequestSchema = z.object({
  targetId: z.string().min(1).optional(),
  url: z.string().url().optional(),
  scanType: z.string().min(1).optional(),
  requestedBy: z.string().min(1),
}).refine(
  (data) => data.targetId || data.url,
  { message: "Either targetId or url must be provided" },
);

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const JobPublicSchema = z.object({
  jobId: z.string().uuid(),
  targetId: z.string(),
  scanType: z.string(),
  status: z.enum([
    JobStatus.QUEUED,
    JobStatus.RUNNING,
    JobStatus.SUCCEEDED,
    JobStatus.FAILED,
    JobStatus.FAILED_ON_RESTART,
  ]),
  requestedBy: z.string(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  summaryJson: z.unknown().nullable(),
  resolvedIpsJson: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});

export type JobPublic = z.infer<typeof JobPublicSchema>;

export const JobListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().optional(),
  targetId: z.string().optional(),
});

export type JobListQuery = z.infer<typeof JobListQuerySchema>;

export const JobListResponseSchema = z.object({
  jobs: z.array(JobPublicSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type JobListResponse = z.infer<typeof JobListResponseSchema>;

import type { FastifyInstance } from "fastify";
import { JobListQuerySchema, ErrorCode } from "@penetragent/shared";
import {
  getJob,
  listJobs,
  listJobsByTarget,
  toJobPublic,
  deleteJob,
  deleteJobsByTarget,
  deleteAllJobs,
} from "../services/job-service.js";
import fs from "node:fs/promises";
import path from "node:path";

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  app.delete("/jobs/all", async () => {
    const deleted = deleteAllJobs(app.db);
    await removeAllReportDirs(app.config.reportsDir);
    return { deleted };
  });

  app.get("/jobs", async (request, reply) => {
    const parsed = JobListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: ErrorCode.VALIDATION_ERROR,
        details: parsed.error.flatten(),
      });
    }
    const query = parsed.data;

    const { jobs, total } = query.targetId
      ? listJobsByTarget(app.db, query.targetId, query.limit, query.offset)
      : listJobs(app.db, query.limit, query.offset, query.status);

    return {
      jobs: jobs.map(toJobPublic),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  app.delete("/jobs", async (request, reply) => {
    const parsed = JobListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: ErrorCode.VALIDATION_ERROR,
        details: parsed.error.flatten(),
      });
    }
    const query = parsed.data;

    if (!query.targetId) {
      return reply.status(400).send({ error: "targetId query parameter required" });
    }

    const { jobs } = listJobsByTarget(app.db, query.targetId, 10000, 0);
    const deleted = deleteJobsByTarget(app.db, query.targetId);

    for (const job of jobs) {
      await removeReportDir(app.config.reportsDir, job.id);
    }

    return { deleted };
  });

  app.get<{ Params: { jobId: string } }>(
    "/jobs/:jobId",
    async (request, reply) => {
      const job = getJob(app.db, request.params.jobId);
      if (!job) {
        return reply.status(404).send({ error: ErrorCode.JOB_NOT_FOUND });
      }
      return toJobPublic(job);
    },
  );

  app.delete<{ Params: { jobId: string } }>(
    "/jobs/:jobId",
    async (request, reply) => {
      const { jobId } = request.params;
      const job = getJob(app.db, jobId);

      if (!job) {
        return reply.status(404).send({ error: ErrorCode.JOB_NOT_FOUND });
      }

      const deleted = deleteJob(app.db, jobId);
      removeReportDir(app.config.reportsDir, jobId);

      return { deleted };
    },
  );
}

async function removeReportDir(reportsDir: string, jobId: string): Promise<void> {
  await fs.rm(path.join(reportsDir, jobId), { recursive: true, force: true });
}

async function removeAllReportDirs(reportsDir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(reportsDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(reportsDir, entry);
    const stat = await fs.stat(entryPath).catch(() => null);
    if (stat?.isDirectory()) {
      await fs.rm(entryPath, { recursive: true, force: true });
    }
  }
}

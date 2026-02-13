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
import fs from "node:fs";
import path from "node:path";

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  app.delete("/jobs/all", async () => {
    const deleted = deleteAllJobs(app.db);
    removeAllReportDirs(app.config.reportsDir);
    return { deleted };
  });

  app.get("/jobs", async (request) => {
    const query = JobListQuerySchema.parse(request.query);

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
    const query = JobListQuerySchema.parse(request.query);

    if (!query.targetId) {
      return reply.status(400).send({ error: "targetId query parameter required" });
    }

    const { jobs } = listJobsByTarget(app.db, query.targetId, 10000, 0);
    const deleted = deleteJobsByTarget(app.db, query.targetId);

    for (const job of jobs) {
      removeReportDir(app.config.reportsDir, job.id);
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

function removeReportDir(reportsDir: string, jobId: string): void {
  fs.rmSync(path.join(reportsDir, jobId), { recursive: true, force: true });
}

function removeAllReportDirs(reportsDir: string): void {
  if (!fs.existsSync(reportsDir)) return;

  for (const entry of fs.readdirSync(reportsDir)) {
    const entryPath = path.join(reportsDir, entry);
    if (fs.statSync(entryPath).isDirectory()) {
      fs.rmSync(entryPath, { recursive: true, force: true });
    }
  }
}

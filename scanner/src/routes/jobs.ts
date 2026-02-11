import type { FastifyInstance } from "fastify";
import { JobListQuerySchema, ErrorCode } from "@penetragent/shared";
import { getJob, listJobs, toJobPublic } from "../services/job-service.js";

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
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

  app.get("/jobs", async (request) => {
    const query = JobListQuerySchema.parse(request.query);
    const { jobs, total } = listJobs(
      app.db,
      query.limit,
      query.offset,
      query.status,
    );
    return {
      jobs: jobs.map(toJobPublic),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });
}

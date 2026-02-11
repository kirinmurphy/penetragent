import type { FastifyInstance } from "fastify";
import { ScanRequestSchema, ErrorCode, SCAN_TYPES } from "@penetragent/shared";
import { getTarget, upsertTarget } from "../services/target-service.js";
import {
  createJob,
  findRunningJob,
  getJob,
  toJobPublic,
} from "../services/job-service.js";

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  app.post("/scan", async (request, reply) => {
    const parsed = ScanRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: ErrorCode.VALIDATION_ERROR,
        details: parsed.error.flatten(),
      });
    }

    const { requestedBy } = parsed.data;
    const scanType = parsed.data.scanType ?? "all";

    if (scanType !== "all" && !(scanType in SCAN_TYPES)) {
      return reply.status(400).send({ error: ErrorCode.INVALID_SCAN_TYPE });
    }

    let targetId: string;
    if (parsed.data.url) {
      const target = upsertTarget(app.db, parsed.data.url);
      targetId = target.id;
    } else {
      targetId = parsed.data.targetId!;
      const target = getTarget(app.db, targetId);
      if (!target) {
        return reply.status(404).send({ error: ErrorCode.TARGET_NOT_FOUND });
      }
    }

    const running = findRunningJob(app.db);
    if (running) {
      return reply.status(429).send({
        error: ErrorCode.RATE_LIMITED,
        runningJobId: running.id,
      });
    }

    const jobId = createJob(app.db, targetId, scanType, requestedBy);
    const job = getJob(app.db, jobId)!;

    return reply.status(201).send(toJobPublic(job));
  });
}

import type { FastifyInstance } from "fastify";
import { listTargets } from "../services/target-service.js";

export async function targetsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/targets", async (_request, reply) => {
    const targets = listTargets(app.db);
    return reply.send({ targets });
  });
}

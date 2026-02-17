import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";

function isInsideDir(parentDir: string, childPath: string): boolean {
  const resolved = path.resolve(childPath);
  const resolvedParent = path.resolve(parentDir) + path.sep;
  return resolved.startsWith(resolvedParent);
}

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/reports/:jobId/html", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const reportsDir = app.config.reportsDir;
    const jobDir = path.join(reportsDir, jobId);

    if (!isInsideDir(reportsDir, jobDir)) {
      return reply.code(400).send({
        error: "INVALID_JOB_ID",
        message: "Invalid job ID",
      });
    }

    try {
      let entries: string[];
      try {
        entries = await fs.readdir(jobDir);
      } catch {
        return reply.code(404).send({
          error: "REPORT_NOT_FOUND",
          message: `HTML report not found for job ${jobId}`,
        });
      }

      const htmlFile = entries.find((f) => f.endsWith(".html"));
      if (!htmlFile) {
        return reply.code(404).send({
          error: "REPORT_NOT_FOUND",
          message: `HTML report not found for job ${jobId}`,
        });
      }

      const htmlContent = await fs.readFile(path.join(jobDir, htmlFile), "utf-8");
      return reply.type("text/html").send(htmlContent);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: "REPORT_READ_ERROR",
        message: "Internal server error",
      });
    }
  });

  app.get("/reports/:jobId/json", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const reportsDir = app.config.reportsDir;
    const jsonPath = path.join(reportsDir, jobId, "report.json");

    if (!isInsideDir(reportsDir, jsonPath)) {
      return reply.code(400).send({
        error: "INVALID_JOB_ID",
        message: "Invalid job ID",
      });
    }

    try {
      const jsonContent = await fs.readFile(jsonPath, "utf-8");
      return reply.type("application/json").send(jsonContent);
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return reply.code(404).send({
          error: "REPORT_NOT_FOUND",
          message: `JSON report not found for job ${jobId}`,
        });
      }
      request.log.error(err);
      return reply.code(500).send({
        error: "REPORT_READ_ERROR",
        message: "Internal server error",
      });
    }
  });
}

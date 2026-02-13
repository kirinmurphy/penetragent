import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/connection.js";
import { migrate } from "./db/migrate.js";
import { reconcileStaleJobs } from "./worker/reconcile.js";
import { startWorker } from "./worker/worker.js";
import { healthRoutes } from "./routes/health.js";
import { scanRoutes } from "./routes/scan.js";
import { jobsRoutes } from "./routes/jobs.js";
import { targetsRoutes } from "./routes/targets.js";
import { reportsRoutes } from "./routes/reports.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = createDatabase(config.dbPath);

  migrate(db);
  console.log("Migrated");

  reconcileStaleJobs(db, config.staleHeartbeatThresholdMs);

  const app = Fastify({ logger: true });
  app.decorate("db", db);
  app.decorate("config", config);

  await app.register(healthRoutes);
  await app.register(scanRoutes);
  await app.register(jobsRoutes);
  await app.register(targetsRoutes);
  await app.register(reportsRoutes);

  startWorker(db, config);

  await app.listen({ port: config.port, host: config.host });
  console.log(`Server listening on ${config.host}:${config.port}`);

  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    await app.close();
    db.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

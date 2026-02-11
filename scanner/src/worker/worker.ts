import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { ScannerConfig } from "@penetragent/shared";
import {
  findRunningJob,
  findOldestQueued,
  transitionToRunning,
  updateHeartbeat,
} from "../services/job-service.js";
import { getTarget } from "../services/target-service.js";
import { executeScan } from "./execute-scan.js";

export function startWorker(
  db: Database.Database,
  config: ScannerConfig,
): void {
  const workerId = crypto.randomUUID();
  console.log(`Worker started: ${workerId}`);

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  async function poll(): Promise<void> {
    try {
      const running = findRunningJob(db);
      if (running) {
        return;
      }

      const queued = findOldestQueued(db);
      if (!queued) {
        return;
      }

      transitionToRunning(db, queued.id, workerId);
      console.log(`Job ${queued.id} → RUNNING`);

      heartbeatTimer = setInterval(() => {
        updateHeartbeat(db, queued.id);
      }, config.heartbeatIntervalMs);

      const target = getTarget(db, queued.target_id);
      if (!target) {
        throw new Error(`Target ${queued.target_id} not found`);
      }

      await executeScan(db, config, queued, target);
      console.log(`Job ${queued.id} → SUCCEEDED`);
    } catch (err) {
      console.error("Worker error:", err);
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }
  }

  setInterval(poll, config.workerPollIntervalMs);
}

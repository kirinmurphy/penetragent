import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { ScannerConfig } from "@penetragent/shared";
import {
  findOldestQueued,
  getJob,
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
  let inFlight = false;

  async function poll(): Promise<void> {
    if (inFlight) {
      return;
    }
    inFlight = true;

    try {
      const queued = findOldestQueued(db);
      if (!queued) {
        return;
      }

      const claimed = transitionToRunning(db, queued.id, workerId);
      if (!claimed) {
        return;
      }
      console.log(`Job ${queued.id} → RUNNING`);

      heartbeatTimer = setInterval(() => {
        updateHeartbeat(db, queued.id);
      }, config.heartbeatIntervalMs);

      const target = getTarget(db, queued.target_id);
      if (!target) {
        throw new Error(`Target ${queued.target_id} not found`);
      }

      await executeScan(db, config, queued, target);
      const finished = getJob(db, queued.id);
      if (finished) {
        console.log(`Job ${queued.id} → ${finished.status}`);
      }
    } catch (err) {
      console.error("Worker error:", err);
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      inFlight = false;
    }
  }

  setInterval(poll, config.workerPollIntervalMs);
}

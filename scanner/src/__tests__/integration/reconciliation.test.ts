import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../../db/migrate.js";
import {
  createJob,
  getJob,
  transitionToRunning,
  markStaleJobsAsFailed,
} from "../../services/job-service.js";

function seedTestTargets(db: Database.Database): void {
  db.prepare(
    "INSERT INTO targets (id, base_url, description) VALUES (?, ?, ?)",
  ).run("staging", "https://staging.example.com", "Test staging");
  db.prepare(
    "INSERT INTO targets (id, base_url, description) VALUES (?, ?, ?)",
  ).run("prod", "https://prod.example.com", "Test prod");
}

describe("Reconciliation integration", () => {
  it("marks stale RUNNING jobs as FAILED_ON_RESTART", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    migrate(db);
    seedTestTargets(db);

    const jobId = createJob(db, "staging", "headers", "test");
    transitionToRunning(db, jobId, "old-worker");

    // Simulate stale heartbeat by backdating
    db.prepare(
      "UPDATE jobs SET last_heartbeat_at = datetime('now', '-2 hours') WHERE id = ?",
    ).run(jobId);

    // Run reconciliation
    const count = markStaleJobsAsFailed(db, 30000);
    expect(count).toBe(1);

    const job = getJob(db, jobId)!;
    expect(job.status).toBe("FAILED_ON_RESTART");
    expect(job.error_code).toBe("SCAN_EXECUTION_FAILED");
    expect(job.error_message).toContain("restarted");
    expect(job.finished_at).not.toBeNull();
  });

  it("does not affect QUEUED or SUCCEEDED jobs", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    migrate(db);
    seedTestTargets(db);

    const queuedId = createJob(db, "staging", "headers", "test");
    const runningId = createJob(db, "staging", "headers", "test");
    transitionToRunning(db, runningId, "worker");

    // Only backdate the running job
    db.prepare(
      "UPDATE jobs SET last_heartbeat_at = datetime('now', '-2 hours') WHERE id = ?",
    ).run(runningId);

    const count = markStaleJobsAsFailed(db, 30000);
    expect(count).toBe(1);

    // Queued job unchanged
    expect(getJob(db, queuedId)!.status).toBe("QUEUED");
    // Running job reconciled
    expect(getJob(db, runningId)!.status).toBe("FAILED_ON_RESTART");
  });

  it("handles multiple stale jobs", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    migrate(db);
    seedTestTargets(db);

    const id1 = createJob(db, "staging", "headers", "test");
    transitionToRunning(db, id1, "worker1");
    db.prepare(
      "UPDATE jobs SET last_heartbeat_at = datetime('now', '-2 hours') WHERE id = ?",
    ).run(id1);

    // Need to clear running status for id1 before creating another running job
    // Actually, markStaleJobsAsFailed handles this by checking all RUNNING jobs
    // But for this test, let's manually insert a second running job
    const id2 = createJob(db, "prod", "headers", "test");
    db.prepare(
      "UPDATE jobs SET status = 'RUNNING', worker_id = 'worker2', last_heartbeat_at = datetime('now', '-3 hours') WHERE id = ?",
    ).run(id2);

    const count = markStaleJobsAsFailed(db, 30000);
    expect(count).toBe(2);
    expect(getJob(db, id1)!.status).toBe("FAILED_ON_RESTART");
    expect(getJob(db, id2)!.status).toBe("FAILED_ON_RESTART");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../db/migrate.js";
import {
  createJob,
  getJob,
  listJobs,
  findRunningJob,
  findOldestQueued,
  transitionToRunning,
  transitionToSucceeded,
  transitionToFailed,
  markStaleJobsAsFailed,
  toJobPublic,
} from "../services/job-service.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migrate(db);
  db.prepare(
    "INSERT INTO targets (id, base_url, description) VALUES (?, ?, ?)",
  ).run("staging", "https://staging.example.com", "Test staging");
  db.prepare(
    "INSERT INTO targets (id, base_url, description) VALUES (?, ?, ?)",
  ).run("prod", "https://prod.example.com", "Test prod");
  return db;
}

describe("job-service", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("creates a QUEUED job", () => {
    const id = createJob(db, "staging", "headers", "user1");
    const job = getJob(db, id);
    expect(job).toBeDefined();
    expect(job!.status).toBe("QUEUED");
    expect(job!.target_id).toBe("staging");
    expect(job!.scan_type).toBe("headers");
    expect(job!.requested_by).toBe("user1");
  });

  it("transitions QUEUED → RUNNING → SUCCEEDED", () => {
    const id = createJob(db, "staging", "headers", "user1");
    transitionToRunning(db, id, "worker-1");
    let job = getJob(db, id)!;
    expect(job.status).toBe("RUNNING");
    expect(job.worker_id).toBe("worker-1");
    expect(job.started_at).not.toBeNull();

    transitionToSucceeded(db, id, JSON.stringify({ good: 3 }));
    job = getJob(db, id)!;
    expect(job.status).toBe("SUCCEEDED");
    expect(job.finished_at).not.toBeNull();
    expect(JSON.parse(job.summary_json!)).toEqual({ good: 3 });
  });

  it("transitions QUEUED → RUNNING → FAILED", () => {
    const id = createJob(db, "staging", "headers", "user1");
    transitionToRunning(db, id, "worker-1");
    transitionToFailed(db, id, "SCAN_EXECUTION_FAILED", "something broke");
    const job = getJob(db, id)!;
    expect(job.status).toBe("FAILED");
    expect(job.error_code).toBe("SCAN_EXECUTION_FAILED");
    expect(job.error_message).toBe("something broke");
    expect(job.finished_at).not.toBeNull();
  });

  it("findRunningJob returns running job", () => {
    const id = createJob(db, "staging", "headers", "user1");
    expect(findRunningJob(db)).toBeUndefined();
    transitionToRunning(db, id, "worker-1");
    expect(findRunningJob(db)).toBeDefined();
    expect(findRunningJob(db)!.id).toBe(id);
  });

  it("findOldestQueued returns oldest", () => {
    const id1 = createJob(db, "staging", "headers", "user1");
    createJob(db, "staging", "headers", "user2");
    expect(findOldestQueued(db)!.id).toBe(id1);
  });

  it("listJobs returns paginated results", () => {
    createJob(db, "staging", "headers", "user1");
    createJob(db, "staging", "headers", "user2");
    createJob(db, "staging", "headers", "user3");

    const { jobs, total } = listJobs(db, 2, 0);
    expect(jobs).toHaveLength(2);
    expect(total).toBe(3);

    const page2 = listJobs(db, 2, 2);
    expect(page2.jobs).toHaveLength(1);
  });

  it("toJobPublic maps row to public shape", () => {
    const id = createJob(db, "staging", "headers", "user1");
    const row = getJob(db, id)!;
    const pub = toJobPublic(row);
    expect(pub.jobId).toBe(id);
    expect(pub.targetId).toBe("staging");
    expect(pub.status).toBe("QUEUED");
  });

  it("reconciliation marks stale RUNNING jobs as FAILED_ON_RESTART", () => {
    const id = createJob(db, "staging", "headers", "user1");
    transitionToRunning(db, id, "worker-1");

    // Manually set heartbeat to past
    db.prepare(
      "UPDATE jobs SET last_heartbeat_at = datetime('now', '-1 hour') WHERE id = ?",
    ).run(id);

    const count = markStaleJobsAsFailed(db, 30000);
    expect(count).toBe(1);

    const job = getJob(db, id)!;
    expect(job.status).toBe("FAILED_ON_RESTART");
    expect(job.error_code).toBe("SCAN_EXECUTION_FAILED");
  });

  it("reconciliation does not touch fresh RUNNING jobs", () => {
    const id = createJob(db, "staging", "headers", "user1");
    transitionToRunning(db, id, "worker-1");
    // heartbeat was just set by transitionToRunning

    const count = markStaleJobsAsFailed(db, 30000);
    expect(count).toBe(0);

    const job = getJob(db, id)!;
    expect(job.status).toBe("RUNNING");
  });
});

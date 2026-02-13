import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { JobPublic } from "@penetragent/shared";

export interface JobRow {
  id: string;
  target_id: string;
  scan_type: string;
  status: string;
  requested_by: string;
  worker_id: string | null;
  error_code: string | null;
  error_message: string | null;
  summary_json: string | null;
  resolved_ips_json: string | null;
  last_heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export function createJob(
  db: Database.Database,
  targetId: string,
  scanType: string,
  requestedBy: string,
): string {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO jobs (id, target_id, scan_type, requested_by)
     VALUES (?, ?, ?, ?)`,
  ).run(id, targetId, scanType, requestedBy);
  return id;
}

export function getJob(
  db: Database.Database,
  jobId: string,
): JobRow | undefined {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as
    | JobRow
    | undefined;
}

export function listJobs(
  db: Database.Database,
  limit: number,
  offset: number,
  status?: string,
): { jobs: JobRow[]; total: number } {
  let query = "SELECT * FROM jobs";
  let countQuery = "SELECT COUNT(*) as total FROM jobs";
  const params: (string | number)[] = [];
  const countParams: string[] = [];

  if (status) {
    const statuses = status.split(",").map((s) => s.trim());
    const placeholders = statuses.map(() => "?").join(",");
    query += ` WHERE status IN (${placeholders})`;
    countQuery += ` WHERE status IN (${placeholders})`;
    params.push(...statuses);
    countParams.push(...statuses);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const jobs = db.prepare(query).all(...params) as JobRow[];
  const { total } = db.prepare(countQuery).get(...countParams) as {
    total: number;
  };
  return { jobs, total };
}

export function findRunningJob(
  db: Database.Database,
): JobRow | undefined {
  return db
    .prepare("SELECT * FROM jobs WHERE status = 'RUNNING' LIMIT 1")
    .get() as JobRow | undefined;
}

export function findOldestQueued(
  db: Database.Database,
): JobRow | undefined {
  return db
    .prepare(
      "SELECT * FROM jobs WHERE status = 'QUEUED' ORDER BY created_at ASC LIMIT 1",
    )
    .get() as JobRow | undefined;
}

export function transitionToRunning(
  db: Database.Database,
  jobId: string,
  workerId: string,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE jobs
     SET status = 'RUNNING', worker_id = ?, started_at = ?, updated_at = ?, last_heartbeat_at = ?
     WHERE id = ? AND status = 'QUEUED'`,
  ).run(workerId, now, now, now, jobId);
}

export function transitionToSucceeded(
  db: Database.Database,
  jobId: string,
  summaryJson: string | null,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE jobs
     SET status = 'SUCCEEDED', summary_json = ?, finished_at = ?, updated_at = ?
     WHERE id = ? AND status = 'RUNNING'`,
  ).run(summaryJson, now, now, jobId);
}

export function transitionToFailed(
  db: Database.Database,
  jobId: string,
  errorCode: string,
  errorMessage: string,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE jobs
     SET status = 'FAILED', error_code = ?, error_message = ?, finished_at = ?, updated_at = ?
     WHERE id = ? AND status = 'RUNNING'`,
  ).run(errorCode, errorMessage, now, now, jobId);
}

export function updateHeartbeat(
  db: Database.Database,
  jobId: string,
): void {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET last_heartbeat_at = ?, updated_at = ? WHERE id = ?",
  ).run(now, now, jobId);
}

export function updateResolvedIps(
  db: Database.Database,
  jobId: string,
  resolvedIpsJson: string,
): void {
  db.prepare(
    "UPDATE jobs SET resolved_ips_json = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(resolvedIpsJson, jobId);
}

export function markStaleJobsAsFailed(
  db: Database.Database,
  thresholdMs: number,
): number {
  const threshold = new Date(Date.now() - thresholdMs).toISOString();
  const result = db
    .prepare(
      `UPDATE jobs
       SET status = 'FAILED_ON_RESTART', error_code = 'SCAN_EXECUTION_FAILED',
           error_message = 'Job was running when scanner restarted',
           finished_at = datetime('now'), updated_at = datetime('now')
       WHERE status = 'RUNNING' AND (last_heartbeat_at < ? OR last_heartbeat_at IS NULL)`,
    )
    .run(threshold);
  return result.changes;
}

export function listJobsByTarget(
  db: Database.Database,
  targetId: string,
  limit: number,
  offset: number,
): { jobs: JobRow[]; total: number } {
  const query = "SELECT * FROM jobs WHERE target_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
  const countQuery = "SELECT COUNT(*) as total FROM jobs WHERE target_id = ?";

  const jobs = db.prepare(query).all(targetId, limit, offset) as JobRow[];
  const { total } = db.prepare(countQuery).get(targetId) as { total: number };

  return { jobs, total };
}

export function deleteJob(db: Database.Database, jobId: string): number {
  const result = db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
  return result.changes;
}

export function deleteJobsByTarget(db: Database.Database, targetId: string): number {
  const result = db.prepare("DELETE FROM jobs WHERE target_id = ?").run(targetId);
  return result.changes;
}

export function deleteAllJobs(db: Database.Database): number {
  const result = db.prepare("DELETE FROM jobs").run();
  return result.changes;
}

export function toJobPublic(row: JobRow): JobPublic {
  return {
    jobId: row.id,
    targetId: row.target_id,
    scanType: row.scan_type,
    status: row.status as JobPublic["status"],
    requestedBy: row.requested_by,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    summaryJson: row.summary_json ? JSON.parse(row.summary_json) : null,
    resolvedIpsJson: row.resolved_ips_json
      ? JSON.parse(row.resolved_ips_json)
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

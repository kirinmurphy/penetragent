import type Database from "better-sqlite3";

export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      base_url TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL REFERENCES targets(id),
      scan_type TEXT NOT NULL DEFAULT 'all',
      status TEXT NOT NULL DEFAULT 'QUEUED',
      requested_by TEXT NOT NULL,
      worker_id TEXT,
      error_code TEXT,
      error_message TEXT,
      summary_json TEXT,
      resolved_ips_json TEXT,
      last_heartbeat_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_target_id ON jobs(target_id);
  `);
}

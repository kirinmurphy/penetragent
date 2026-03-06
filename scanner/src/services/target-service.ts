import type Database from "better-sqlite3";

export interface Target {
  id: string;
  base_url: string;
  description: string | null;
  created_at: string;
}

export function getTarget(
  db: Database.Database,
  targetId: string,
): Target | undefined {
  return db.prepare("SELECT * FROM targets WHERE id = ?").get(targetId) as
    | Target
    | undefined;
}

export function listTargets(db: Database.Database): Target[] {
  return db.prepare("SELECT * FROM targets ORDER BY id").all() as Target[];
}

export function upsertTarget(
  db: Database.Database,
  url: string,
): Target {
  const hostname = new URL(url).hostname;
  const existing = getTarget(db, hostname);
  if (existing) {
    if (existing.base_url !== url) {
      db.prepare(
        "UPDATE targets SET base_url = ? WHERE id = ?",
      ).run(url, hostname);
      return getTarget(db, hostname)!;
    }
    return existing;
  }
  db.prepare(
    "INSERT INTO targets (id, base_url, description) VALUES (?, ?, ?)",
  ).run(hostname, url, `Ad-hoc target from URL`);
  return getTarget(db, hostname)!;
}

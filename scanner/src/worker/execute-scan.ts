import type Database from "better-sqlite3";
import type { ScannerConfig } from "@penetragent/shared";
import { ErrorCode } from "@penetragent/shared";
import {
  transitionToSucceeded,
  transitionToFailed,
  updateResolvedIps,
} from "../services/job-service.js";
import type { JobRow } from "../services/job-service.js";
import type { Target } from "../services/target-service.js";
import {
  verifyPublicOnly,
  DnsError,
} from "../security/verify-public-only.js";
import { runHttpScan } from "../scanTypes/crawl/index.js";
import { createUnifiedReport } from "../services/unified-report-service.js";
import { writeHtmlReport } from "../services/html-report-service.js";

export async function executeScan(
  db: Database.Database,
  config: ScannerConfig,
  job: JobRow,
  target: Target,
): Promise<void> {
  const url = new URL(target.base_url);

  let resolvedIps: string[];
  try {
    resolvedIps = await verifyPublicOnly(url.hostname);
    updateResolvedIps(db, job.id, JSON.stringify(resolvedIps));
  } catch (err) {
    if (err instanceof DnsError) {
      updateResolvedIps(db, job.id, JSON.stringify([]));
      transitionToFailed(db, job.id, err.code, err.message);
      return;
    }
    throw err;
  }

  try {
    const { report, summary } = await runHttpScan(target.base_url);

    const reportBuilder = createUnifiedReport(job.id, target.base_url);
    reportBuilder.addHttpScan(report, summary);
    reportBuilder.write(config.reportsDir);

    try {
      writeHtmlReport(config.reportsDir, job.id, target.id);
    } catch (htmlErr) {
      console.error(`Failed to write HTML report for job ${job.id}:`, htmlErr);
    }

    transitionToSucceeded(db, job.id, JSON.stringify(summary));
  } catch (err) {
    transitionToFailed(
      db,
      job.id,
      ErrorCode.SCAN_EXECUTION_FAILED,
      err instanceof Error ? err.message : String(err),
    );
  }
}

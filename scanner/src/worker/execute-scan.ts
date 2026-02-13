import type Database from "better-sqlite3";
import type { ScannerConfig } from "@penetragent/shared";
import { ErrorCode, SCAN_TYPES } from "@penetragent/shared";
import type { ScanTypeId } from "@penetragent/shared";
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
import { runHeadersScan } from "../scanTypes/headers.js";
import { runCrawlScan } from "../scanTypes/crawl/index.js";

async function runScanType(
  scanType: ScanTypeId,
  baseUrl: string,
  reportsDir: string,
  jobId: string,
): Promise<unknown> {
  switch (scanType) {
    case "headers": {
      const { summary } = await runHeadersScan(baseUrl, reportsDir, jobId);
      return summary;
    }
    case "crawl": {
      const { summary } = await runCrawlScan(baseUrl, reportsDir, jobId);
      return summary;
    }
  }
}

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
    const typesToRun: ScanTypeId[] =
      job.scan_type === "all"
        ? (Object.keys(SCAN_TYPES) as ScanTypeId[])
        : [job.scan_type as ScanTypeId];

    const results: Record<string, unknown> = {};
    for (const scanType of typesToRun) {
      results[scanType] = await runScanType(
        scanType,
        target.base_url,
        config.reportsDir,
        job.id,
      );
    }

    // If only one scan type ran, use its result directly for backward compat
    const summary = typesToRun.length === 1 ? results[typesToRun[0]] : results;
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

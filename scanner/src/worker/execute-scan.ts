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
  createOutboundPolicy,
  DnsError,
} from "../security/outbound-policy.js";
import { runHttpScan } from "../scanTypes/http/index.js";
import { runTlsScan } from "../scanTypes/tls/index.js";
import { createUnifiedReport } from "../reports/unified-report-service.js";
import { writeHtmlReport } from "../reports/html/index.js";

export async function executeScan(
  db: Database.Database,
  config: ScannerConfig,
  job: JobRow,
  target: Target,
): Promise<void> {
  const url = new URL(target.base_url);
  const outboundPolicy = createOutboundPolicy({
    scannerConfig: config,
    targetUrl: target.base_url,
    jobId: job.id,
  });

  try {
    await outboundPolicy.verifyUrl(url);
    const resolvedIps = outboundPolicy.getResolvedIps(url.hostname) ?? [];
    updateResolvedIps(db, job.id, JSON.stringify(resolvedIps));
  } catch (err) {
    if (err instanceof DnsError) {
      updateResolvedIps(db, job.id, JSON.stringify([]));
      transitionToFailed(db, job.id, err.code, err.message);
      return;
    }
    transitionToFailed(
      db,
      job.id,
      ErrorCode.SCAN_EXECUTION_FAILED,
      err instanceof Error ? err.message : String(err),
    );
    return;
  }

  const scanType = job.scan_type;
  const shouldRunHttp = scanType === "http" || scanType === "all";
  const shouldRunTls = scanType === "tls" || scanType === "all";

  try {
    const reportBuilder = createUnifiedReport(job.id, target.base_url);
    const summaryResult: { http?: Record<string, unknown>; tls?: Record<string, unknown> } = {};

    if (shouldRunHttp) {
      const { report, summary } = await runHttpScan(target.base_url, undefined, {
        verifyUrl: (scanUrl) => outboundPolicy.verifyUrl(scanUrl),
      });
      reportBuilder.addHttpScan(report, summary);
      summaryResult.http = summary as unknown as Record<string, unknown>;
    }

    if (shouldRunTls) {
      const { report, summary } = await runTlsScan(target.base_url, {
        verifyUrl: (scanUrl) => outboundPolicy.verifyUrl(scanUrl),
      });
      reportBuilder.addTlsScan(report, summary);
      summaryResult.tls = summary as unknown as Record<string, unknown>;
    }

    reportBuilder.write(config.reportsDir);

    try {
      writeHtmlReport(config.reportsDir, job.id, target.id);
    } catch (htmlErr) {
      console.error(`Failed to write HTML report for job ${job.id}:`, htmlErr);
    }

    transitionToSucceeded(db, job.id, JSON.stringify(summaryResult));
  } catch (err) {
    transitionToFailed(
      db,
      job.id,
      ErrorCode.SCAN_EXECUTION_FAILED,
      err instanceof Error ? err.message : String(err),
    );
  }
}

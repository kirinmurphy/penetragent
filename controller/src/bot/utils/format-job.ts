import { TERMINAL_STATUSES, SCAN_TYPES } from "@penetragent/shared";
import type { JobPublic, ScanTypeId } from "@penetragent/shared";
import { formatSummary } from "./format-summary.js";
import { formatHumanDate } from "./format-date.js";
import { formatDuration } from "./format-duration.js";

const SEPARATOR = "───────────────────";

export function formatJob(job: JobPublic): string {
  const lines = [
    SEPARATOR,
    `Security Scan Report - ${job.status}`,
    "",
    job.targetId,
    job.jobId,
  ];

  if (job.scanType !== "all") {
    const scanTypeName = SCAN_TYPES[job.scanType as ScanTypeId]?.name || job.scanType;
    lines.push(`Scan Type: ${scanTypeName}`);
  }

  if (job.finishedAt && job.createdAt) {
    const duration = formatDuration(job.createdAt, job.finishedAt);
    const formattedDate = formatHumanDate(job.finishedAt);
    const durationSuffix = duration ? ` (completed in ${duration})` : "";
    lines.push(`Finished: ${formattedDate}${durationSuffix}`);
  } else if (job.createdAt) {
    lines.push(`Created: ${formatHumanDate(job.createdAt)}`);
  }

  if (job.errorCode) {
    lines.push(`Error: ${job.errorCode}`);
    if (job.errorMessage) lines.push(`Message: ${job.errorMessage}`);
  }

  if (job.summaryJson && TERMINAL_STATUSES.has(job.status)) {
    const summary = job.summaryJson as Record<string, unknown>;
    lines.push("");
    lines.push("Summary:");
    lines.push(...formatSummary(summary));
  }

  return lines.join("\n");
}

import { TERMINAL_STATUSES, JobStatus } from "@penetragent/shared";
import type { JobPublic } from "@penetragent/shared";
import type { Bot, Context } from "grammy";
import type { ScannerClient } from "../scanner-client/client.js";
import { formatSummary } from "../bot/utils/format-summary.js";

const MAX_JOBS_TO_RECOVER = 100;

const IN_PROGRESS_STATUSES = `${JobStatus.RUNNING},${JobStatus.QUEUED}`;

function formatJob(job: JobPublic): string {
  const lines = [
    `Job: ${job.jobId}`,
    `Target: ${job.targetId}`,
    `Scan Type: ${job.scanType}`,
    `Status: ${job.status}`,
    `Created: ${job.createdAt}`,
  ];

  if (job.startedAt) lines.push(`Started: ${job.startedAt}`);
  if (job.finishedAt) lines.push(`Finished: ${job.finishedAt}`);

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

export class JobPoller {
  private readonly polls = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    private readonly client: ScannerClient,
    private readonly bot: Bot<Context>,
    private readonly pollIntervalMs: number,
    private readonly pollTimeoutMs: number,
  ) {}

  async recoverInProgressJobs(): Promise<void> {
    try {
      const response = await this.client.listJobs({
        limit: MAX_JOBS_TO_RECOVER,
        status: IN_PROGRESS_STATUSES,
      });
      const inProgressJobs = response.jobs;

      if (inProgressJobs.length > 0) {
        console.log(
          `Recovering ${inProgressJobs.length} in-progress job(s)...`,
        );
        for (const job of inProgressJobs) {
          const chatId = parseInt(job.requestedBy, 10);
          if (!isNaN(chatId)) {
            console.log(`Resuming polling for job ${job.jobId}`);
            this.startPolling(job.jobId, chatId);
          } else {
            console.warn(
              `Cannot resume job ${job.jobId}: invalid requestedBy "${job.requestedBy}"`,
            );
          }
        }
      }
    } catch (err) {
      console.error("Failed to recover in-progress jobs:", err);
    }
  }

  startPolling(jobId: string, chatId: number): void {
    if (this.polls.has(jobId)) {
      console.log(
        `Polling already active for job ${jobId}, skipping duplicate`,
      );
      return;
    }

    const startTime = Date.now();

    const timer = setInterval(async () => {
      try {
        if (Date.now() - startTime > this.pollTimeoutMs) {
          this.stopPolling(jobId);
          await this.bot.api.sendMessage(
            chatId,
            `Job ${jobId} polling timed out. Use "status ${jobId}" to check manually.`,
          );
          return;
        }

        const job = await this.client.getJob(jobId);

        if (TERMINAL_STATUSES.has(job.status)) {
          this.stopPolling(jobId);
          await this.bot.api.sendMessage(chatId, formatJob(job));
        }
      } catch (err) {
        console.error(`Polling error for job ${jobId}:`, err);
      }
    }, this.pollIntervalMs);

    this.polls.set(jobId, timer);
  }

  private stopPolling(jobId: string): void {
    const timer = this.polls.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.polls.delete(jobId);
    }
  }
}

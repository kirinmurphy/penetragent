import { TERMINAL_STATUSES, JobStatus } from "@penetragent/shared";
import type { Bot, Context } from "grammy";
import type { ScannerClient } from "../scanner-client/client.js";

// Recovery settings - fetch only in-progress jobs for efficiency
const MAX_JOBS_TO_RECOVER = 100; // Should handle any realistic number of simultaneous scans
const IN_PROGRESS_STATUSES = `${JobStatus.RUNNING},${JobStatus.QUEUED}`;

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
      // Optimized: Only fetch RUNNING/QUEUED jobs instead of all jobs
      const response = await this.client.listJobs(
        MAX_JOBS_TO_RECOVER,
        0,
        IN_PROGRESS_STATUSES,
      );
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
      console.log(`Polling already active for job ${jobId}, skipping duplicate`);
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

          const shortId = jobId.substring(0, 8);
          const lines = [
            `Scan completed for ${job.targetId}`,
            `Job: ${shortId}...`,
            `Status: ${job.status}`,
          ];

          if (job.errorCode) {
            lines.push(`Error: ${job.errorCode}`);
            if (job.errorMessage) lines.push(`Message: ${job.errorMessage}`);
          }

          if (job.summaryJson) {
            const summary = job.summaryJson as Record<string, unknown>;
            lines.push("");
            lines.push("Summary:");
            for (const [key, value] of Object.entries(summary)) {
              if (Array.isArray(value)) {
                lines.push(`  ${key}: ${value.join(", ") || "none"}`);
              } else {
                lines.push(`  ${key}: ${value}`);
              }
            }
          }

          lines.push("");
          lines.push(`For detailed report, use: status ${jobId}`);

          await this.bot.api.sendMessage(chatId, lines.join("\n"));
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

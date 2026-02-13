import { TERMINAL_STATUSES, JobStatus } from "@penetragent/shared";
import type { JobPublic } from "@penetragent/shared";
import type { Bot, Context } from "grammy";
import { InputFile } from "grammy";
import type { ScannerClient } from "../scanner-client/client.js";
import { formatJob } from "../bot/utils/format-job.js";

const MAX_JOBS_TO_RECOVER = 100;
const TELEGRAM_CAPTION_LIMIT = 1024;
const REPORT_FETCH_TIMEOUT_MS = 30_000;

function truncateCaption(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= TELEGRAM_CAPTION_LIMIT) return text;
  return chars.slice(0, TELEGRAM_CAPTION_LIMIT - 3).join("") + "...";
}

function buildReportFilename(targetId: string, finishedAt: string): string {
  const date = new Date(finishedAt).toISOString().split("T")[0];
  return `${targetId}-${date}.html`;
}

const IN_PROGRESS_STATUSES = `${JobStatus.RUNNING},${JobStatus.QUEUED}`;

export class JobPoller {
  private readonly polls = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    private readonly client: ScannerClient,
    private readonly bot: Bot<Context>,
    private readonly pollIntervalMs: number,
    private readonly pollTimeoutMs: number,
    private readonly scannerBaseUrl: string,
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

          if (job.status === JobStatus.SUCCEEDED) {
            await this.sendHtmlReport(job, chatId, formatJob(job));
          } else {
            await this.bot.api.sendMessage(chatId, formatJob(job));
          }
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

  private async sendHtmlReport(job: JobPublic, chatId: number, statusMessage: string): Promise<void> {
    try {
      const reportUrl = `${this.scannerBaseUrl}/reports/${job.jobId}/html`;
      const response = await fetch(reportUrl, {
        signal: AbortSignal.timeout(REPORT_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        console.error(`Failed to fetch HTML report for job ${job.jobId}: ${response.status}`);
        await this.bot.api.sendMessage(chatId, statusMessage);
        return;
      }

      const htmlContent = await response.text();
      const buffer = Buffer.from(htmlContent, "utf-8");
      const caption = truncateCaption(statusMessage);
      const filename = buildReportFilename(job.targetId, job.finishedAt ?? new Date().toISOString());

      await this.bot.api.sendDocument(
        chatId,
        new InputFile(buffer, filename),
        { caption },
      );
    } catch (err) {
      console.error(`Error sending HTML report for job ${job.jobId}:`, err);
      await this.bot.api.sendMessage(chatId, statusMessage);
    }
  }
}

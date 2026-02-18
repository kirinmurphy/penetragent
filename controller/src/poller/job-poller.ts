import {
  TERMINAL_STATUSES,
  JobStatus,
  IN_PROGRESS_STATUSES,
} from "@penetragent/shared";
import type { Bot, Context } from "grammy";
import type { ScannerClient } from "../scanner-client/client.js";
import { formatJob } from "../bot/utils/format-job.js";
import { sendHtmlReport } from "./send-report.js";
import { TUNING } from "../tuning.js";

export interface JobPollerConfig {
  client: ScannerClient;
  bot: Bot<Context>;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  scannerBaseUrl: string;
}

export type JobPoller = ReturnType<typeof createJobPoller>;

export function createJobPoller(config: JobPollerConfig) {
  const { client, bot, pollIntervalMs, pollTimeoutMs, scannerBaseUrl } = config;
  const polls = new Map<string, ReturnType<typeof setInterval>>();

  function startPolling(jobId: string, chatId: number): void {
    if (polls.has(jobId)) {
      console.log(
        `Polling already active for job ${jobId}, skipping duplicate`,
      );
      return;
    }

    const startTime = Date.now();

    const timer = setInterval(async () => {
      try {
        if (Date.now() - startTime > pollTimeoutMs) {
          stopPolling(jobId);
          await bot.api.sendMessage(
            chatId,
            `Job ${jobId} polling timed out. Use "status ${jobId}" to check manually.`,
          );
          return;
        }

        const job = await client.getJob(jobId);

        if (!TERMINAL_STATUSES.has(job.status)) return;

        stopPolling(jobId);

        if (job.status === JobStatus.SUCCEEDED) {
          await sendHtmlReport({
            job,
            chatId,
            scannerBaseUrl,
            bot,
            statusMessage: formatJob(job),
          });
        } else {
          await bot.api.sendMessage(chatId, formatJob(job));
        }
      } catch (err) {
        console.error(`Polling error for job ${jobId}:`, err);
      }
    }, pollIntervalMs);

    polls.set(jobId, timer);
  }

  async function recoverInProgressJobs(): Promise<void> {
    try {
      const response = await client.listJobs({
        limit: TUNING.polling.maxJobsToRecover,
        status: IN_PROGRESS_STATUSES,
      });

      if (response.jobs.length === 0) return;

      console.log(`Recovering ${response.jobs.length} in-progress job(s)...`);

      for (const job of response.jobs) {
        const chatId = parseInt(job.requestedBy, 10);
        if (isNaN(chatId)) {
          console.warn(
            `Cannot resume job ${job.jobId}: invalid requestedBy "${job.requestedBy}"`,
          );
          continue;
        }
        console.log(`Resuming polling for job ${job.jobId}`);
        startPolling(job.jobId, chatId);
      }
    } catch (err) {
      console.error("Failed to recover in-progress jobs:", err);
    }
  }

  function stopPolling(jobId: string): void {
    const timer = polls.get(jobId);
    if (timer) {
      clearInterval(timer);
      polls.delete(jobId);
    }
  }

  return { startPolling, recoverInProgressJobs };
}

import type { JobPublic } from "@penetragent/shared";
import type { Bot, Context } from "grammy";
import { InputFile } from "grammy";
import { TUNING } from "../tuning.js";

export async function sendHtmlReport(config: {
  job: JobPublic;
  chatId: number;
  statusMessage: string;
  scannerBaseUrl: string;
  bot: Bot<Context>;
}): Promise<void> {
  const { job, chatId, statusMessage, scannerBaseUrl, bot } = config;

  try {
    const reportUrl = `${scannerBaseUrl}/reports/${job.jobId}/html`;
    const response = await fetch(reportUrl, {
      signal: AbortSignal.timeout(TUNING.polling.reportFetchTimeoutMs),
    });

    if (!response.ok) {
      console.error(`Failed to fetch HTML report for job ${job.jobId}: ${response.status}`);
      await bot.api.sendMessage(chatId, statusMessage);
      return;
    }

    const htmlContent = await response.text();
    const buffer = Buffer.from(htmlContent, "utf-8");
    const caption = truncateCaption(statusMessage);
    const filename = buildReportFilename(job.targetId, job.finishedAt ?? new Date().toISOString());

    await bot.api.sendDocument(
      chatId,
      new InputFile(buffer, filename),
      { caption },
    );
  } catch (err) {
    console.error(`Error sending HTML report for job ${job.jobId}:`, err);
    await bot.api.sendMessage(chatId, statusMessage);
  }
}

function truncateCaption(text: string): string {
  const limit = TUNING.telegram.captionCharLimit;
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  return chars.slice(0, limit - 3).join("") + "...";
}

function buildReportFilename(targetId: string, finishedAt: string): string {
  const d = new Date(finishedAt);
  const date = isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  return date ? `${targetId}-${date}.html` : `${targetId}-report.html`;
}

import type { Context } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";

export async function handleHistory(
  ctx: Context,
  client: ScannerClient,
): Promise<void> {
  try {
    await ctx.api.sendChatAction(ctx.chat!.id, "typing");
    const { jobs, total } = await client.listJobs(10, 0);

    if (jobs.length === 0) {
      await ctx.reply("No scan history found.");
      return;
    }

    const lines = [`Recent scans (${jobs.length} of ${total}):`];
    for (const job of jobs) {
      lines.push(
        `\n• ${job.jobId.slice(0, 8)}… | ${job.targetId}/${job.scanType} | ${job.status} | ${job.createdAt}`,
      );
    }

    await ctx.reply(lines.join("\n"));
  } catch {
    await ctx.reply("Could not fetch scan history.");
  }
}

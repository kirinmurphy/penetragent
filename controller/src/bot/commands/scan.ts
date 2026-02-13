import type { Context } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";
import type { JobPoller } from "../../poller/job-poller.js";
import { handleScannerError } from "../utils/error-handler.js";
import { CHAT_ACTION } from "../constants.js";

export async function handleScan(params: {
  ctx: Context;
  args: string[];
  client: ScannerClient;
  poller: JobPoller;
}): Promise<void> {
  const { ctx, args, client, poller } = params;
  if (args.length < 1) {
    await ctx.reply("Usage: scan <url> [scanType]\nExample: scan https://example.com headers");
    return;
  }

  const [target, scanType] = args;
  const userId = ctx.from!.id.toString();
  const chatId = ctx.chat!.id;

  try {
    await ctx.api.sendChatAction(chatId, CHAT_ACTION.TYPING);
    const job = await client.createScan(target, userId, scanType);
    await ctx.reply(
      `Scan started!\nJob ID: ${job.jobId}\nStatus: ${job.status}\n\nI'll notify you when it completes.`,
    );
    poller.startPolling(job.jobId, chatId);
  } catch (err) {
    await handleScannerError(ctx, err);
  }
}

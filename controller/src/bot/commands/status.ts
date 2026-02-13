import type { Context } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";
import { handleCommandError } from "../utils/error-handler.js";
import { formatJob } from "../utils/format-job.js";
import { CHAT_ACTION } from "../constants.js";

export async function handleStatus(params: {
  ctx: Context;
  args: string[];
  client: ScannerClient;
}): Promise<void> {
  const { ctx, args, client } = params;
  if (args.length < 1) {
    await ctx.reply("Usage: status <jobId>");
    return;
  }

  const jobId = args[0];

  try {
    await ctx.api.sendChatAction(ctx.chat!.id, CHAT_ACTION.TYPING);
    const job = await client.getJob(jobId);
    await ctx.reply(formatJob(job));
  } catch (err) {
    await handleCommandError(ctx, err, `Could not find job: ${jobId}`);
  }
}

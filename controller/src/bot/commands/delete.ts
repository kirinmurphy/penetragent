import type { Context } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";
import { detectIdentifier } from "../utils/detect-identifier.js";
import type { DeleteConfirmationManager } from "../utils/delete-confirmation.js";
import { INPUT_ALL, IDENTIFIER_TYPE, DELETION_TYPE } from "../constants.js";
import { resolveTargetId } from "../utils/resolve-target-id.js";

export async function handleDelete(params: {
  ctx: Context;
  args: string[];
  client: ScannerClient;
  confirmationManager: DeleteConfirmationManager;
}): Promise<void> {
  const { ctx, args, client, confirmationManager } = params;
  if (!ctx.chat) {
    return;
  }

  if (args.length === 0) {
    await ctx.reply("Usage: delete <[JOBID]|[TARGET]|[FULL_URL]|all>");
    return;
  }

  const chatId = ctx.chat.id;
  const input = args[0];

  try {
    if (input === INPUT_ALL) {
      const { total } = await client.listJobs({ limit: 1 });

      if (total === 0) {
        await ctx.reply("No scans to delete.");
        return;
      }

      confirmationManager.setPending(chatId, {
        identifier: INPUT_ALL,
        type: DELETION_TYPE.ALL,
        count: total,
      });

      await ctx.reply(
        `This will permanently delete all ${total} scans.\n\nReply \`confirm\` within 60 seconds to proceed.`,
      );
      return;
    }

    const detected = detectIdentifier(input);

    if (detected.type === IDENTIFIER_TYPE.UNKNOWN) {
      await ctx.reply(`Invalid identifier: ${input}`);
      return;
    }

    if (detected.type === IDENTIFIER_TYPE.JOB_ID) {
      const job = await client.getJob(detected.value);

      confirmationManager.setPending(chatId, {
        identifier: detected.value,
        type: DELETION_TYPE.JOB,
        count: 1,
      });

      await ctx.reply(
        `This will permanently delete 1 scan for ${job.targetId}.\n\nReply \`confirm\` within 60 seconds to proceed.`,
      );
      return;
    }

    let targetId = detected.value;
    if (detected.type === IDENTIFIER_TYPE.URL) {
      const resolved = resolveTargetId(detected.value);
      if (!resolved.ok) {
        await ctx.reply(resolved.error);
        return;
      }
      targetId = resolved.targetId;
    }

    const { total } = await client.listJobsByTarget({ targetId, limit: 1 });

    if (total === 0) {
      await ctx.reply(`No scans found for ${targetId}`);
      return;
    }

    confirmationManager.setPending(chatId, {
      identifier: targetId,
      type: DELETION_TYPE.TARGET,
      count: total,
    });

    await ctx.reply(
      `This will permanently delete ${total} scan${total > 1 ? "s" : ""} for ${targetId}.\n\nReply \`confirm\` within 60 seconds to proceed.`,
    );
  } catch (err) {
    await ctx.reply(
      `Error: Could not find scans for ${input}${err instanceof Error ? ` (${err.message})` : ""}`,
    );
  }
}


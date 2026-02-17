import type { Context } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";
import type { DeleteConfirmationManager } from "../utils/delete-confirmation.js";
import { CHAT_ACTION, DELETION_TYPE } from "../constants.js";
import { deletionLabel } from "../utils/deletion-label.js";

export async function handleConfirmDelete(params: {
  ctx: Context;
  client: ScannerClient;
  confirmationManager: DeleteConfirmationManager;
}): Promise<void> {
  const { ctx, client, confirmationManager } = params;
  if (!ctx.chat) {
    return;
  }

  const chatId = ctx.chat.id;
  const pending = confirmationManager.getPending(chatId);

  if (!pending) {
    await ctx.reply("No pending deletion. Use `delete <identifier>` first.");
    return;
  }

  try {
    await ctx.api.sendChatAction(chatId, CHAT_ACTION.TYPING);

    let result: { deleted: number };

    if (pending.type === DELETION_TYPE.ALL) {
      result = await client.deleteAllJobs();
    } else if (pending.type === DELETION_TYPE.JOB) {
      result = await client.deleteJob(pending.identifier);
    } else {
      result = await client.deleteJobsByTarget(pending.identifier);
    }

    confirmationManager.clearPending(chatId);

    const label = deletionLabel(pending.type, result.deleted, pending.identifier);
    await ctx.reply(`Deleted ${result.deleted} ${label}`);
  } catch (err) {
    confirmationManager.clearPending(chatId);
    await ctx.reply(
      `Error: Could not delete scans${err instanceof Error ? ` (${err.message})` : ""}`,
    );
  }
}

import { Bot } from "grammy";
import type { ControllerConfig } from "@penetragent/shared";
import { allowlistMiddleware } from "./middleware/allowlist.js";
import { parseCommand } from "./command-parser.js";
import { handleHelp } from "./commands/help.js";
import { handleTargets } from "./commands/targets.js";
import { handleScanTypes } from "./commands/scantypes.js";
import { handleScan } from "./commands/scan.js";
import { handleStatus } from "./commands/status.js";
import { handleHistory } from "./commands/history.js";
import { handleDelete } from "./commands/delete.js";
import { handleConfirmDelete } from "./commands/confirm-delete.js";
import { createDeleteConfirmationManager } from "./utils/delete-confirmation.js";
import { createScannerClient } from "../scanner-client/client.js";
import { createJobPoller } from "../poller/job-poller.js";
import type { JobPoller } from "../poller/job-poller.js";
import { COMMAND } from "./constants.js";
import { TUNING } from "../tuning.js";

export interface BotContext {
  bot: Bot;
  poller: JobPoller;
}

export function createBot(config: ControllerConfig): BotContext {
  const bot = new Bot(config.telegramBotToken);
  const client = createScannerClient(config.scannerBaseUrl);
  const poller = createJobPoller({
    client,
    bot,
    pollIntervalMs: config.pollIntervalMs,
    pollTimeoutMs: config.pollTimeoutMs,
    scannerBaseUrl: config.scannerBaseUrl,
  });

  const confirmationManager = createDeleteConfirmationManager();

  setInterval(() => confirmationManager.cleanupExpired(), TUNING.confirmationCleanupIntervalMs);

  bot.use(allowlistMiddleware(config.telegramAllowedUserId));

  bot.on("message:text", async (ctx) => {
    const parsed = parseCommand(ctx.message.text);
    if (!parsed) {
      await ctx.reply(
        'Unknown command. Type "help" for available commands.',
      );
      return;
    }

    switch (parsed.command) {
      case COMMAND.HELP:
        await handleHelp(ctx);
        break;
      case COMMAND.TARGETS:
        await handleTargets({ ctx, client });
        break;
      case COMMAND.SCANTYPES:
        await handleScanTypes(ctx);
        break;
      case COMMAND.SCAN:
        await handleScan({ ctx, args: parsed.args, client, poller });
        break;
      case COMMAND.STATUS:
        await handleStatus({ ctx, args: parsed.args, client });
        break;
      case COMMAND.HISTORY:
        await handleHistory({ ctx, args: parsed.args, client });
        break;
      case COMMAND.DELETE:
        await handleDelete({ ctx, args: parsed.args, client, confirmationManager });
        break;
      case COMMAND.CONFIRM:
        await handleConfirmDelete({ ctx, client, confirmationManager });
        break;
      default:
        confirmationManager.clearPending(ctx.chat!.id);
    }

    if (parsed.command !== COMMAND.CONFIRM && parsed.command !== COMMAND.DELETE) {
      confirmationManager.clearPending(ctx.chat!.id);
    }
  });

  return { bot, poller };
}

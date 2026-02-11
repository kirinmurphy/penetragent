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
import { ScannerClient } from "../scanner-client/client.js";
import { JobPoller } from "../poller/job-poller.js";

export interface BotContext {
  bot: Bot;
  poller: JobPoller;
}

export function createBot(config: ControllerConfig): BotContext {
  const bot = new Bot(config.telegramBotToken);
  const client = new ScannerClient(config.scannerBaseUrl);
  const poller = new JobPoller(
    client,
    bot,
    config.pollIntervalMs,
    config.pollTimeoutMs,
  );

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
      case "help":
        await handleHelp(ctx);
        break;
      case "targets":
        await handleTargets(ctx, client);
        break;
      case "scantypes":
        await handleScanTypes(ctx);
        break;
      case "scan":
        await handleScan(ctx, parsed.args, client, poller);
        break;
      case "status":
        await handleStatus(ctx, parsed.args, client);
        break;
      case "history":
        await handleHistory(ctx, client);
        break;
    }
  });

  return { bot, poller };
}

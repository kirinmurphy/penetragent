import { loadConfig } from "./config.js";
import { createBot } from "./bot/bot.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { bot, poller } = createBot(config);

  console.log("Starting controller bot...");
  await bot.start({
    onStart: async () => {
      console.log("Bot is running");
      console.log("Checking for in-progress jobs to recover...");
      await poller.recoverInProgressJobs();
    },
  });

  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    await bot.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

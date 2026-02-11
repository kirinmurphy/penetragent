import type { ControllerConfig } from "@penetragent/shared";

export function loadConfig(): ControllerConfig {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const telegramAllowedUserId = process.env.TELEGRAM_ALLOWED_USER_ID;
  if (!telegramAllowedUserId) {
    throw new Error("TELEGRAM_ALLOWED_USER_ID is required");
  }

  return {
    telegramBotToken,
    telegramAllowedUserId,
    scannerBaseUrl: process.env.SCANNER_BASE_URL || "http://localhost:8080",
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "3000", 10),
    pollTimeoutMs: parseInt(process.env.POLL_TIMEOUT_MS || "300000", 10),
  };
}

import type { Context } from "grammy";
import {
  RateLimitedError,
  ScannerUnavailableError,
  ScannerApiError,
} from "../../scanner-client/client.js";

/**
 * Handles scanner-related errors and sends appropriate user-friendly messages
 */
export async function handleScannerError(
  ctx: Context,
  error: unknown,
): Promise<void> {
  if (error instanceof RateLimitedError) {
    await ctx.reply(
      `A scan is already running (job: ${error.runningJobId}). Please wait for it to finish.`,
    );
  } else if (error instanceof ScannerUnavailableError) {
    await ctx.reply("Scanner service is unavailable. Please try again later.");
  } else if (error instanceof ScannerApiError) {
    await ctx.reply(
      `Scanner error (${error.statusCode}): ${error.message}`,
    );
  } else {
    await ctx.reply("An unexpected error occurred. Please try again.");
    console.error("Unexpected error:", error);
  }
}

/**
 * Generic error handler for simple command failures
 */
export async function handleCommandError(
  ctx: Context,
  error: unknown,
  fallbackMessage = "Could not complete the request.",
): Promise<void> {
  if (error instanceof ScannerUnavailableError) {
    await ctx.reply("Scanner service is unavailable. Please try again later.");
  } else {
    await ctx.reply(fallbackMessage);
    console.error("Command error:", error);
  }
}

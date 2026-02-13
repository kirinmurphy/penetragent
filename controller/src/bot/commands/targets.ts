import type { Context } from "grammy";
import type { ScannerClient } from "../../scanner-client/client.js";
import { handleCommandError } from "../utils/error-handler.js";

export async function handleTargets(params: {
  ctx: Context;
  client: ScannerClient;
}): Promise<void> {
  const { ctx, client } = params;
  try {
    const targets = await client.listTargets();
    if (targets.length === 0) {
      await ctx.reply(
        "No targets yet. Scan a URL to add one:\nscan https://example.com",
      );
      return;
    }
    const lines = targets.map(
      (t) => `• ${t.id} — ${t.base_url}`,
    );
    await ctx.reply(["Previously scanned targets:", "", ...lines].join("\n"));
  } catch (err) {
    await handleCommandError(ctx, err, "Could not reach scanner service.");
  }
}

import type { Context } from "grammy";
import { SCAN_TYPES } from "@penetragent/shared";

export async function handleScanTypes(ctx: Context): Promise<void> {
  const lines = ["Available scan types:", ""];
  for (const [id, info] of Object.entries(SCAN_TYPES)) {
    lines.push(`• ${id} — ${info.name}`);
  }
  await ctx.reply(lines.join("\n"));
}

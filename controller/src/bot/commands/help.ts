import type { Context } from "grammy";

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      "Available commands:",
      "",
      "help — Show this message",
      "targets — List previously scanned targets",
      "scantypes — List available scan types",
      "scan <url> [scanType] — Scan a URL",
      "status <jobId> — Check scan status",
      "history — Show recent scan history",
    ].join("\n"),
  );
}

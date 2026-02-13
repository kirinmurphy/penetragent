import type { Context } from "grammy";

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      "Available commands:",
      "",
      "help — Show this message",
      "targets — List previously scanned targets",
      "scantypes — List available scan types",
      "",
      "scan <url> — Start a new scan",
      "scan <url> [scanType] — Start a new scan for a specific scanType",
      "status <jobId> — Check scan status and results",
      "",
      "history — Show last 10 unique targets",
      "history <number> — Show last N unique targets",
      "history <target> — Show all scans for a target",
      "history all — Show all scans",
      "",
      "delete <identifier> — Delete scan(s) (requires confirmation)",
      "delete all — Delete all scans (requires confirmation)",
      "confirm — Confirm pending deletion",
      "",
      "Examples:",
      "  scan https://example.com",
      "  scan https://example.com crawl",
      "  status abc123...",
      "  delete abc123...",
      "  history 25",
      "  history example.com",
      "  delete example.com",
      "  confirm",
    ].join("\n"),
  );
}

import type { Context } from "grammy";
import { TUNING } from "../../tuning.js";

export async function sendChunked(ctx: Context, header: string, lines: string[]): Promise<void> {
  const limit = TUNING.telegram.messageCharLimit;
  let chunk = "";
  const allLines = [header, ...lines];

  for (const line of allLines) {
    const segments = splitOversized(line, limit);

    for (const segment of segments) {
      const wouldOverflow = chunk.length + segment.length + 1 > limit;

      if (wouldOverflow && chunk.length > 0) {
        await ctx.reply(chunk);
        chunk = "";
      }

      chunk += (chunk.length > 0 ? "\n" : "") + segment;
    }
  }

  if (chunk.length > 0) {
    await ctx.reply(chunk);
  }
}

function splitOversized(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  const parts: string[] = [];
  for (let i = 0; i < text.length; i += limit) {
    parts.push(text.slice(i, i + limit));
  }
  return parts;
}

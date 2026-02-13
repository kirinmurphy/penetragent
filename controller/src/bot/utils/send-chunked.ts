import type { Context } from "grammy";

const TELEGRAM_MSG_LIMIT = 4000;

export async function sendChunked(ctx: Context, header: string, lines: string[]): Promise<void> {
  let chunk = "";
  const allLines = [header, ...lines];

  for (const line of allLines) {
    const segments = splitOversized(line, TELEGRAM_MSG_LIMIT);

    for (const segment of segments) {
      const wouldOverflow = chunk.length + segment.length + 1 > TELEGRAM_MSG_LIMIT;

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

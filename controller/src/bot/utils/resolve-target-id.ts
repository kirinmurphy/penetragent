type ResolveResult =
  | { ok: true; targetId: string }
  | { ok: false; error: string };

export function resolveTargetId(value: string): ResolveResult {
  try {
    const url = new URL(value);
    return { ok: true, targetId: url.hostname };
  } catch {
    return { ok: false, error: `Invalid URL: ${value}` };
  }
}

export function buildTargetUrl(targetId: string): string {
  if (targetId.startsWith("http://") || targetId.startsWith("https://")) {
    return targetId;
  }
  return `https://${targetId}`;
}

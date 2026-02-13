export function extractLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links: Set<string> = new Set();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === new URL(baseUrl).origin) {
        links.add(url.href);
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  return Array.from(links);
}

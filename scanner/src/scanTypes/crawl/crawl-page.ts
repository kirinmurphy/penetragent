import { CRAWL_CONFIG } from "../scan-config.js";
import { extractLinks } from "./extract-links.js";
import { checkSecurityIssues } from "./check-security-issues.js";
import type { CrawlPage } from "./index.js";

export async function crawlPage(url: string): Promise<{ page: CrawlPage; links: string[] }> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(CRAWL_CONFIG.requestTimeoutMs),
      headers: { "User-Agent": CRAWL_CONFIG.userAgent },
    });

    const contentType = response.headers.get("content-type");
    const body = contentType?.includes("text/html")
      ? await response.text()
      : "";

    const securityIssues = checkSecurityIssues(response, body);
    const links = body ? extractLinks(body, url) : [];

    return {
      page: { url, statusCode: response.status, contentType, securityIssues },
      links,
    };
  } catch (err) {
    return {
      page: {
        url,
        statusCode: 0,
        contentType: null,
        securityIssues: [
          `Failed to fetch: ${err instanceof Error ? err.message : String(err)}`,
        ],
      },
      links: [],
    };
  }
}

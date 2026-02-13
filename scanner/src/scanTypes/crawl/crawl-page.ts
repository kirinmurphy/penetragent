import { HTTP_SCAN_CONFIG } from "../scan-config.js";
import { extractLinks } from "./extract-links.js";
import { checkSecurityIssues } from "./check-security-issues.js";
import type { PageData } from "@penetragent/shared";

export interface CrawlPageResult {
  page: PageData;
  links: string[];
  metaGenerator: string | null;
  redirectChain: string[] | null;
}

function extractMetaGenerator(body: string): string | null {
  const match = body.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i);
  if (match) return match[1];
  const altMatch = body.match(/<meta\s+content=["']([^"']+)["']\s+name=["']generator["']/i);
  return altMatch ? altMatch[1] : null;
}

async function followRedirects(url: string): Promise<{ chain: string[]; response: Response }> {
  const chain: string[] = [];
  let currentUrl = url;

  for (let i = 0; i < HTTP_SCAN_CONFIG.maxRedirects; i++) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(HTTP_SCAN_CONFIG.requestTimeoutMs),
      headers: { "User-Agent": HTTP_SCAN_CONFIG.userAgent },
    });
    chain.push(currentUrl);

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    return { chain, response };
  }

  throw new Error(`Too many redirects (max ${HTTP_SCAN_CONFIG.maxRedirects})`);
}

export async function crawlPage(
  url: string,
  options?: { trackRedirects?: boolean },
): Promise<CrawlPageResult> {
  try {
    let response: Response;
    let redirectChain: string[] | null = null;

    if (options?.trackRedirects) {
      const result = await followRedirects(url);
      response = result.response;
      redirectChain = result.chain;
    } else {
      response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(HTTP_SCAN_CONFIG.requestTimeoutMs),
        headers: { "User-Agent": HTTP_SCAN_CONFIG.userAgent },
      });
    }

    const contentType = response.headers.get("content-type");
    const body = contentType?.includes("text/html")
      ? await response.text()
      : "";

    const { headerGrades, infoLeakage, contentIssues } = checkSecurityIssues(response, body);
    const links = body ? extractLinks(body, url) : [];
    const metaGenerator = body ? extractMetaGenerator(body) : null;

    return {
      page: { url, statusCode: response.status, contentType, headerGrades, infoLeakage, contentIssues },
      links,
      metaGenerator,
      redirectChain,
    };
  } catch (err) {
    return {
      page: {
        url,
        statusCode: 0,
        contentType: null,
        headerGrades: [],
        infoLeakage: [],
        contentIssues: [
          `Failed to fetch: ${err instanceof Error ? err.message : String(err)}`,
        ],
      },
      links: [],
      metaGenerator: null,
      redirectChain: null,
    };
  }
}

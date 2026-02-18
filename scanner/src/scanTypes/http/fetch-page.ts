import { HTTP_SCAN_CONFIG } from "../../config/scan-rules.js";
import { extractLinks } from "./extract-links.js";
import { checkSecurityIssues } from "./check-security-issues.js";
import { analyzeCookies } from "./analyze-cookies.js";
import { analyzeScripts } from "./analyze-scripts.js";
import type { PageData } from "@penetragent/shared";

export interface FetchPageResult {
  page: PageData;
  links: string[];
  metaGenerator: string | null;
  redirectChain: string[] | null;
}

function extractMetaGenerator(body: string): string | null {
  for (const pattern of HTTP_SCAN_CONFIG.metaGeneratorPatterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
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

export async function fetchPage(
  url: string,
  options?: { trackRedirects?: boolean },
): Promise<FetchPageResult> {
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
    const finalUrl = redirectChain && redirectChain.length > 0
      ? redirectChain[redirectChain.length - 1]
      : (response.url || url);
    const links = body ? extractLinks(body, finalUrl) : [];
    const metaGenerator = body ? extractMetaGenerator(body) : null;

    const cookieResult = analyzeCookies(response, url);
    const scriptResult = body ? analyzeScripts(body, finalUrl) : null;

    return {
      page: {
        url, statusCode: response.status, contentType, headerGrades, infoLeakage, contentIssues,
        ...(cookieResult.totalScanned > 0 && { totalCookiesScanned: cookieResult.totalScanned }),
        ...(cookieResult.issues.length > 0 && { cookieIssues: cookieResult.issues }),
        ...(scriptResult && scriptResult.totalExternal > 0 && { totalExternalScripts: scriptResult.totalExternal }),
        ...(scriptResult && scriptResult.issues.length > 0 && { scriptIssues: scriptResult.issues }),
      },
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

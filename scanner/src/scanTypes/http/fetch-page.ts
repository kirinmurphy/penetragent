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

interface FetchPageOptions {
  trackRedirects?: boolean;
  verifyUrl?: (url: URL) => Promise<void>;
}

function extractMetaGenerator(body: string): string | null {
  for (const pattern of HTTP_SCAN_CONFIG.metaGeneratorPatterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function followRedirects(
  url: string,
  options?: FetchPageOptions,
): Promise<{ chain: string[]; response: Response }> {
  const chain: string[] = [];
  let currentUrl = url;

  for (let i = 0; i < HTTP_SCAN_CONFIG.maxRedirects; i++) {
    const currentParsed = new URL(currentUrl);
    if (options?.verifyUrl) {
      await options.verifyUrl(currentParsed);
    }

    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(HTTP_SCAN_CONFIG.requestTimeoutMs),
      headers: { "User-Agent": HTTP_SCAN_CONFIG.userAgent },
    });
    chain.push(currentUrl);

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      const nextUrl = new URL(location, currentUrl);
      if (options?.verifyUrl) {
        await options.verifyUrl(nextUrl);
      }
      currentUrl = nextUrl.href;
      continue;
    }
    return { chain, response };
  }

  throw new Error(`Too many redirects (max ${HTTP_SCAN_CONFIG.maxRedirects})`);
}

export async function fetchPage(
  url: string,
  options?: FetchPageOptions,
): Promise<FetchPageResult> {
  try {
    const result = await followRedirects(url, options);
    const response = result.response;
    const redirectChain = options?.trackRedirects ? result.chain : null;

    const contentType = response.headers.get("content-type");
    const isHtml = contentType?.includes("text/html");
    if (!isHtml) await response.body?.cancel();
    const body = isHtml ? await response.text() : "";

    const { headerGrades, infoLeakage, contentIssues } = checkSecurityIssues(response, body);
    const finalUrl = redirectChain && redirectChain.length > 0
      ? redirectChain[redirectChain.length - 1]
      : (response.url || url);
    const links = body ? extractLinks(body, finalUrl) : [];
    const metaGenerator = body ? extractMetaGenerator(body) : null;

    const cookieResult = analyzeCookies(response, finalUrl);
    const scriptResult = body ? analyzeScripts(body, finalUrl) : null;

    return {
      page: {
        url: finalUrl, statusCode: response.status, contentType, headerGrades, infoLeakage, contentIssues,
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

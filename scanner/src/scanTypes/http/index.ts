import { HTTP_SCAN_CONFIG } from "../../config/scan-rules.js";
import { computeWorstCaseGrades } from "./compute-worst-grades.js";
import { fetchPage } from "./fetch-page.js";
import { analyzeCors } from "./analyze-cors.js";
import { collectFindingsByPage } from "./collect-findings.js";
import type {
  PageData,
  HttpReportData,
  HttpSummaryData,
} from "@penetragent/shared";

export type { PageData };

interface CrawlResult {
  pages: PageData[];
  redirectChain: string[];
  metaGenerators: string[];
}

async function crawlPages(
  baseUrl: string,
  maxPages: number,
): Promise<CrawlResult> {
  const queued = new Set<string>([baseUrl]);
  const toVisit: string[] = [baseUrl];
  const pages: PageData[] = [];
  let redirectChain: string[] = [];
  const metaGenerators: string[] = [];

  while (toVisit.length > 0 && pages.length < maxPages) {
    const url = toVisit.shift()!;
    const isFirstPage = pages.length === 0;
    const result = await fetchPage(url, { trackRedirects: isFirstPage });

    pages.push(result.page);

    if (isFirstPage) {
      if (result.redirectChain) {
        redirectChain = result.redirectChain;
      }
      result.page.corsChecked = true;
      const corsIssues = await analyzeCors(baseUrl);
      if (corsIssues.length > 0) {
        result.page.corsIssues = corsIssues;
      }
    }
    if (result.metaGenerator) {
      metaGenerators.push(result.metaGenerator);
    }

    for (const link of result.links) {
      if (!queued.has(link)) {
        queued.add(link);
        toVisit.push(link);
      }
    }
  }

  return { pages, redirectChain, metaGenerators };
}

function buildHttpReport(config: {
  baseUrl: string;
  crawl: CrawlResult;
  findings: string[];
}): HttpReportData {
  const { baseUrl, crawl, findings } = config;
  return {
    startUrl: baseUrl,
    pagesScanned: crawl.pages.length,
    pages: crawl.pages,
    findings,
    redirectChain: crawl.redirectChain,
    metaGenerators: [...new Set(crawl.metaGenerators)],
    timestamp: new Date().toISOString(),
  };
}

function buildHttpSummary(config: {
  pages: PageData[];
  findings: string[];
}): HttpSummaryData {
  const { pages, findings } = config;
  const criticalFindings = findings.filter((finding) =>
    HTTP_SCAN_CONFIG.criticalFindingPatterns.some((pattern) =>
      finding.includes(pattern),
    ),
  );
  const { good, weak, missing } = computeWorstCaseGrades(pages);
  return {
    pagesScanned: pages.length,
    issuesFound: findings.length,
    good,
    weak,
    missing,
    criticalFindings,
  };
}

export async function runHttpScan(
  baseUrl: string,
  maxPages: number = HTTP_SCAN_CONFIG.maxPages,
): Promise<{ report: HttpReportData; summary: HttpSummaryData }> {
  const crawl = await crawlPages(baseUrl, maxPages);
  const findingsMap = collectFindingsByPage(crawl.pages);
  const findings = Array.from(findingsMap.keys());
  const report = buildHttpReport({ baseUrl, crawl, findings });
  const summary = buildHttpSummary({ pages: crawl.pages, findings });
  return { report, summary };
}

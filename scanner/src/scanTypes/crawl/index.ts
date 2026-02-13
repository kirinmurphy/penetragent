import fs from "node:fs";
import path from "node:path";
import { CRAWL_CONFIG } from "../scan-config.js";
import { crawlPage } from "./crawl-page.js";

export interface CrawlPage {
  url: string;
  statusCode: number;
  contentType: string | null;
  securityIssues: string[];
}

export interface CrawlReport {
  startUrl: string;
  pagesScanned: number;
  pages: CrawlPage[];
  findings: string[];
  timestamp: string;
}

export interface CrawlSummary {
  pagesScanned: number;
  issuesFound: number;
  criticalFindings: string[];
}

export async function runCrawlScan(
  baseUrl: string,
  reportsDir: string,
  jobId: string,
): Promise<{ report: CrawlReport; summary: CrawlSummary }> {
  const queued = new Set<string>([baseUrl]);
  const toVisit: string[] = [baseUrl];
  const pages: CrawlPage[] = [];

  while (toVisit.length > 0 && pages.length < CRAWL_CONFIG.maxPages) {
    const url = toVisit.shift()!;
    const { page, links } = await crawlPage(url);
    pages.push(page);

    for (const link of links) {
      if (!queued.has(link)) {
        queued.add(link);
        toVisit.push(link);
      }
    }
  }

  const allFindings = new Set(pages.flatMap((p) => p.securityIssues));

  const report: CrawlReport = {
    startUrl: baseUrl,
    pagesScanned: pages.length,
    pages,
    findings: Array.from(allFindings),
    timestamp: new Date().toISOString(),
  };

  const criticalFindings = report.findings.filter((finding) =>
    CRAWL_CONFIG.criticalFindingPatterns.some((pattern) =>
      finding.includes(pattern),
    ),
  );

  const summary: CrawlSummary = {
    pagesScanned: pages.length,
    issuesFound: allFindings.size,
    criticalFindings,
  };

  const jobDir = path.join(reportsDir, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(
    path.join(jobDir, "crawl.json"),
    JSON.stringify(report, null, 2),
  );

  return { report, summary };
}

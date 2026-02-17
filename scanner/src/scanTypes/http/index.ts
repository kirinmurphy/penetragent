import { HTTP_SCAN_CONFIG, GRADE } from "../scan-config.js";
import { computeWorstCaseGrades } from "../compute-worst-grades.js";
import { fetchPage } from "./fetch-page.js";
import type {
  PageData,
  HttpReportData,
  HttpSummaryData,
} from "@penetragent/shared";

export type { PageData };

export async function runHttpScan(
  baseUrl: string,
  maxPages: number = HTTP_SCAN_CONFIG.maxPages,
): Promise<{ report: HttpReportData; summary: HttpSummaryData }> {
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

    if (isFirstPage && result.redirectChain) {
      redirectChain = result.redirectChain;
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

  const findingsSet = new Set<string>();
  for (const page of pages) {
    for (const grade of page.headerGrades) {
      if (grade.grade === GRADE.MISSING) {
        findingsSet.add(`Missing ${grade.header} header`);
      } else if (grade.grade === GRADE.WEAK) {
        findingsSet.add(`Weak ${grade.header}: ${grade.reason}`);
      }
    }
    for (const leak of page.infoLeakage) {
      findingsSet.add(`${leak.header} header disclosed: ${leak.value}`);
    }
    for (const issue of page.contentIssues) {
      findingsSet.add(issue);
    }
  }

  const findings = Array.from(findingsSet);

  const report: HttpReportData = {
    startUrl: baseUrl,
    pagesScanned: pages.length,
    pages,
    findings,
    redirectChain,
    metaGenerators: [...new Set(metaGenerators)],
    timestamp: new Date().toISOString(),
  };

  const criticalFindings = findings.filter((finding) =>
    HTTP_SCAN_CONFIG.criticalFindingPatterns.some((pattern) =>
      finding.includes(pattern),
    ),
  );

  const { good, weak, missing } = computeWorstCaseGrades(pages);

  const summary: HttpSummaryData = {
    pagesScanned: pages.length,
    issuesFound: findingsSet.size,
    good,
    weak,
    missing,
    criticalFindings,
  };

  return { report, summary };
}

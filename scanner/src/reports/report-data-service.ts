import type { UnifiedReport } from "@penetragent/shared";
import {
  aggregateIssues,
  collectMatchedFrameworks,
  computeWorstCaseGrades,
  classifyAndSortIssues,
  classifyIssuesByType,
  groupScriptIssues,
} from "./issue-processing.js";
import { computeCookieSummary, computeScriptSummary, computeCorsSummary, processTlsData } from "./section-summaries.js";
import { classifyFindings, buildGroupedAiPromptData } from "./ai-prompt.js";
import { buildPrintChecklist } from "./print-checklist.js";
import type { ProcessedReportData } from "./report-types.js";

export type {
  FrameworkFix,
  AggregatedIssue,
  HeaderGradeSummary,
  AiPromptData,
  PrintChecklistItem,
  PrintChecklistSection,
  GroupedScriptIssue,
  CookieSummary,
  ScriptSummary,
  CorsSummary,
  TlsProcessedData,
  ProcessedReportData,
} from "./report-types.js";

export {
  getExplanationKey,
  aggregateIssues,
  collectMatchedFrameworks,
  computeWorstCaseGrades,
  classifyAndSortIssues,
  classifyIssuesByType,
  groupScriptIssues,
} from "./issue-processing.js";

export { computeCookieSummary, computeScriptSummary, computeCorsSummary, processTlsData } from "./section-summaries.js";
export { buildAiPromptData, classifyFindings, buildGroupedAiPromptData } from "./ai-prompt.js";
export { buildPrintChecklist } from "./print-checklist.js";

export function processReportData(report: UnifiedReport): ProcessedReportData {
  const httpData = report.scans.http;

  const issueMap = httpData
    ? aggregateIssues(httpData)
    : new Map<string, { pages: string[] }>();

  const totalPages = httpData?.pages.length ?? 0;
  const isMultiPage = totalPages > 1;
  const matchedFrameworks = collectMatchedFrameworks(report.detectedTechnologies);

  const allClassifiedIssues = classifyAndSortIssues({
    issueMap,
    detectedTechs: report.detectedTechnologies,
  });

  const { headerIssues, cookieIssues, scriptIssues, corsIssues } = classifyIssuesByType(allClassifiedIssues);

  const techNames = report.detectedTechnologies.map((t) => t.name);
  const groupedScriptIssues = groupScriptIssues(scriptIssues, matchedFrameworks, techNames);

  const headerGradeSummary = httpData
    ? computeWorstCaseGrades(httpData)
    : { good: 0, weak: 0, missing: 0 };

  const pages = httpData?.pages ?? [];
  const cookieSummary = computeCookieSummary(pages);
  const scriptSummary = computeScriptSummary(pages);
  const corsSummary = computeCorsSummary(pages);

  const tlsData = report.scans.tls;
  const tls = tlsData ? processTlsData(tlsData, report.detectedTechnologies) : null;

  const httpFindings = httpData?.findings ?? [];
  const tlsFindings = tlsData?.findings ?? [];
  const classifiedFindings = classifyFindings(httpFindings, tlsFindings);

  const aiPrompt = (httpFindings.length > 0 || tlsFindings.length > 0)
    ? buildGroupedAiPromptData({
        targetUrl: report.targetUrl,
        detectedTechs: report.detectedTechnologies,
        classifiedFindings,
      })
    : null;

  const scannedPages = httpData
    ? httpData.pages.map((p) => ({ url: p.url, statusCode: p.statusCode, contentType: p.contentType }))
    : [];

  const printChecklist = buildPrintChecklist({
    headerIssues,
    tlsIssues: tls?.issues ?? [],
    cookieIssues,
    scriptIssues,
    corsIssues,
    matchedFrameworks,
  });

  const formattedDate = new Date(report.timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    targetUrl: report.targetUrl,
    timestamp: report.timestamp,
    formattedDate,
    isMultiPage,
    totalPages,
    redirectChain: httpData?.redirectChain ?? [],
    headerGradeSummary,
    issues: headerIssues,
    cookieIssues,
    scriptIssues,
    groupedScriptIssues,
    corsIssues,
    cookieSummary,
    scriptSummary,
    corsSummary,
    matchedFrameworks,
    aiPrompt,
    scannedPages,
    printChecklist,
    tls,
  };
}

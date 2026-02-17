import type { UnifiedReport, DetectedTechnology, TlsReportData } from "@penetragent/shared";
import { findExplanation, SECURITY_EXPLANATIONS, type SecurityExplanation } from "../scanTypes/security-explanations.js";
import { HTTP_SCAN_CONFIG } from "../scanTypes/http/http-scan-config.js";
import { TLS_SCAN_CONFIG } from "../scanTypes/tls/tls-scan-config.js";
import { computeWorstCaseGrades as computeWorstCaseGradesShared } from "../scanTypes/http/compute-worst-grades.js";
import { collectFindingsByPage } from "../scanTypes/http/collect-findings.js";
import { countGradeDistribution } from "../grading/count-grades.js";
import { classifyByPrefix, SECTION_LABELS } from "../grading/issue-classification.js";
import { slugify } from "../utils/string.js";

export interface FrameworkFix {
  framework: string;
  slug: string;
  fix: string;
}

export interface AggregatedIssue {
  issue: string;
  pages: string[];
  isCritical: boolean;
  explanationKey: string;
  explanation: SecurityExplanation | undefined;
  matchedFrameworks: FrameworkFix[];
}

export interface HeaderGradeSummary {
  good: number;
  weak: number;
  missing: number;
}

export interface AiPromptData {
  promptText: string;
  techStackLabel: string;
  findings: string[];
}

export interface PrintChecklistItem {
  issue: string;
  genericFix: string;
  frameworkFixes: FrameworkFix[];
}

export interface PrintChecklistSection {
  label: string;
  items: PrintChecklistItem[];
}

export interface GroupedScriptIssue {
  issueType: string;
  scripts: string[];
  isCritical: boolean;
  explanationKey: string;
  explanation: SecurityExplanation | undefined;
  matchedFrameworks: FrameworkFix[];
}

export interface CookieSummary {
  totalCookies: number;
  insecureCookies: number;
}

export interface ScriptSummary {
  externalScripts: number;
  missingSri: number;
  vulnerableLibraries: number;
}

export interface CorsSummary {
  pagesTested: number;
  issuesFound: number;
}

export interface TlsProcessedData {
  host: string;
  port: number;
  certificate: TlsReportData["certificate"];
  chain: TlsReportData["chain"];
  protocols: TlsReportData["protocols"];
  cipher: TlsReportData["cipher"];
  grades: TlsReportData["grades"];
  gradeSummary: { good: number; weak: number; missing: number };
  issues: AggregatedIssue[];
}

export interface ProcessedReportData {
  targetUrl: string;
  timestamp: string;
  formattedDate: string;
  isMultiPage: boolean;
  totalPages: number;
  redirectChain: string[];
  headerGradeSummary: HeaderGradeSummary;
  issues: AggregatedIssue[];
  cookieIssues: AggregatedIssue[];
  scriptIssues: AggregatedIssue[];
  groupedScriptIssues: GroupedScriptIssue[];
  corsIssues: AggregatedIssue[];
  cookieSummary: CookieSummary;
  scriptSummary: ScriptSummary;
  corsSummary: CorsSummary;
  matchedFrameworks: { name: string; slug: string }[];
  aiPrompt: AiPromptData | null;
  scannedPages: { url: string; statusCode: number; contentType: string | null }[];
  printChecklist: PrintChecklistSection[];
  tls: TlsProcessedData | null;
}

export function getExplanationKey(issue: string): string {
  if (issue.startsWith("Missing ") && issue.includes(" header")) {
    return issue.replace("Missing ", "").replace(" header", "");
  }
  if (issue.startsWith("Weak ")) {
    return issue.replace("Weak ", "").split(":")[0];
  }
  return issue;
}

export function aggregateIssues(
  httpData: NonNullable<UnifiedReport["scans"]["http"]>,
): Map<string, { pages: string[] }> {
  const findingsMap = collectFindingsByPage(httpData.pages);
  const issueMap = new Map<string, { pages: string[] }>();
  for (const [key, pages] of findingsMap) {
    issueMap.set(key, { pages });
  }
  return issueMap;
}

export function collectMatchedFrameworks(
  detectedTechs: DetectedTechnology[],
): { name: string; slug: string }[] {
  const techNames = new Set(detectedTechs.map((t) => t.name));
  const matched = new Set<string>();

  for (const explanation of Object.values(SECURITY_EXPLANATIONS)) {
    if (!explanation.remediation.frameworks) continue;
    for (const framework of Object.keys(explanation.remediation.frameworks)) {
      if (techNames.has(framework)) {
        matched.add(framework);
      }
    }
  }

  return Array.from(matched).map((name) => ({ name, slug: slugify(name) }));
}

export function computeWorstCaseGrades(
  httpData: NonNullable<UnifiedReport["scans"]["http"]>,
): HeaderGradeSummary {
  return computeWorstCaseGradesShared(httpData.pages);
}

export function classifyAndSortIssues(config: {
  issueMap: Map<string, { pages: string[] }>;
  detectedTechs: DetectedTechnology[];
  criticalPatterns?: string[];
}): AggregatedIssue[] {
  const { issueMap, detectedTechs } = config;
  const patterns = config.criticalPatterns ?? HTTP_SCAN_CONFIG.criticalFindingPatterns;
  const techNames = detectedTechs.map((t) => t.name);

  return Array.from(issueMap.entries())
    .sort((a, b) => b[1].pages.length - a[1].pages.length)
    .map(([issue, { pages }]) => {
      const isCritical = patterns.some((p) => issue.includes(p));
      const explanationKey = getExplanationKey(issue);
      const explanation = findExplanation(explanationKey);

      const matchedFrameworks: FrameworkFix[] = [];
      if (explanation?.remediation.frameworks) {
        for (const [framework, fix] of Object.entries(explanation.remediation.frameworks)) {
          if (techNames.includes(framework)) {
            matchedFrameworks.push({ framework, slug: slugify(framework), fix });
          }
        }
      }

      return { issue, pages, isCritical, explanationKey, explanation, matchedFrameworks };
    });
}

export function buildAiPromptData(config: {
  targetUrl: string;
  detectedTechs: DetectedTechnology[];
  findings: string[];
}): AiPromptData | null {
  const { targetUrl, detectedTechs, findings } = config;
  if (findings.length === 0) return null;

  const techStackLabel = detectedTechs.map((t) => t.name).join(", ") || "Unknown";
  const findingsList = findings.map((f, i) => `${i + 1}. ${f}`).join("\n");

  const promptText =
`You are a security remediation agent. A security scan was run on ${targetUrl} and found the issues listed below. The detected technology stack is: ${techStackLabel}.

For each issue, provide the exact configuration change or code fix needed for this technology stack, how to verify the fix worked, and any caveats or side effects.

Issues to fix:
${findingsList}`;

  return { promptText, techStackLabel, findings };
}

function buildChecklistItems(
  issues: AggregatedIssue[],
  matchedFrameworks: { name: string; slug: string }[],
): PrintChecklistItem[] {
  return issues.map((aggregated) => {
    const genericFix = aggregated.explanation?.remediation.generic ?? "";

    const frameworkFixes: FrameworkFix[] = matchedFrameworks
      .map((fw) => {
        const fix = aggregated.explanation?.remediation.frameworks?.[fw.name];
        if (!fix) return null;
        return { framework: fw.name, slug: fw.slug, fix };
      })
      .filter((f): f is FrameworkFix => f !== null);

    return { issue: aggregated.issue, genericFix, frameworkFixes };
  });
}

export function buildPrintChecklist(config: {
  headerIssues: AggregatedIssue[];
  tlsIssues: AggregatedIssue[];
  cookieIssues: AggregatedIssue[];
  scriptIssues: AggregatedIssue[];
  corsIssues: AggregatedIssue[];
  matchedFrameworks: { name: string; slug: string }[];
}): PrintChecklistSection[] {
  const { matchedFrameworks } = config;

  const sections: { label: string; issues: AggregatedIssue[] }[] = [
    { label: "Security Headers", issues: config.headerIssues },
    { label: "SSL/TLS", issues: config.tlsIssues },
    { label: "Cookie Security", issues: config.cookieIssues },
    { label: "Script & Dependency Security", issues: config.scriptIssues },
    { label: "CORS Configuration", issues: config.corsIssues },
  ];

  return sections
    .filter(({ issues }) => issues.length > 0)
    .map(({ label, issues }) => ({
      label,
      items: buildChecklistItems(issues, matchedFrameworks),
    }));
}

function aggregateTlsIssues(
  tlsData: TlsReportData,
): Map<string, { pages: string[] }> {
  const issueMap = new Map<string, { pages: string[] }>();
  for (const finding of tlsData.findings) {
    issueMap.set(finding, { pages: [tlsData.host] });
  }
  return issueMap;
}

function processTlsData(
  tlsData: TlsReportData,
  detectedTechs: DetectedTechnology[],
): TlsProcessedData {
  const issueMap = aggregateTlsIssues(tlsData);
  const issues = classifyAndSortIssues({
    issueMap,
    detectedTechs,
    criticalPatterns: TLS_SCAN_CONFIG.criticalFindingPatterns,
  });

  const { good, weak, missing } = countGradeDistribution(tlsData.grades);

  return {
    host: tlsData.host,
    port: tlsData.port,
    certificate: tlsData.certificate,
    chain: tlsData.chain,
    protocols: tlsData.protocols,
    cipher: tlsData.cipher,
    grades: tlsData.grades,
    gradeSummary: { good, weak, missing },
    issues,
  };
}

function computeCookieSummary(pages: NonNullable<UnifiedReport["scans"]["http"]>["pages"]): CookieSummary {
  let totalCookies = 0;
  let insecureCookies = 0;
  for (const page of pages) {
    totalCookies += page.totalCookiesScanned ?? 0;
    insecureCookies += (page.cookieIssues ?? []).length;
  }
  return { totalCookies, insecureCookies };
}

function computeScriptSummary(pages: NonNullable<UnifiedReport["scans"]["http"]>["pages"]): ScriptSummary {
  let externalScripts = 0;
  let missingSri = 0;
  let vulnerableLibraries = 0;
  for (const page of pages) {
    externalScripts += page.totalExternalScripts ?? 0;
    for (const script of page.scriptIssues ?? []) {
      if (!script.hasSri) missingSri++;
      if (script.libraryMatch) vulnerableLibraries++;
    }
  }
  return { externalScripts, missingSri, vulnerableLibraries };
}

function computeCorsSummary(pages: NonNullable<UnifiedReport["scans"]["http"]>["pages"]): CorsSummary {
  let pagesTested = 0;
  let issuesFound = 0;
  for (const page of pages) {
    if (page.corsChecked) pagesTested++;
    issuesFound += (page.corsIssues ?? []).length;
  }
  return { pagesTested, issuesFound };
}

function classifyIssuesByType(allIssues: AggregatedIssue[]): {
  headerIssues: AggregatedIssue[];
  cookieIssues: AggregatedIssue[];
  scriptIssues: AggregatedIssue[];
  corsIssues: AggregatedIssue[];
} {
  const classified = classifyByPrefix({
    items: allIssues,
    getText: (issue) => issue.issue,
  });
  return {
    headerIssues: classified.headers,
    cookieIssues: classified.cookies,
    scriptIssues: classified.scripts,
    corsIssues: classified.cors,
  };
}

export function groupScriptIssues(
  issues: AggregatedIssue[],
  globalFrameworks: { name: string; slug: string }[],
  techNames: string[],
): GroupedScriptIssue[] {
  const groups = new Map<string, { scripts: string[]; base: AggregatedIssue }>();

  for (const issue of issues) {
    const colonIdx = issue.issue.indexOf(": ");
    const type = colonIdx >= 0 ? issue.issue.substring(0, colonIdx) : issue.issue;
    const detail = colonIdx >= 0 ? issue.issue.substring(colonIdx + 2) : "";

    if (!groups.has(type)) {
      groups.set(type, { scripts: [], base: issue });
    }
    if (detail) {
      groups.get(type)!.scripts.push(detail);
    }
  }

  return Array.from(groups.entries()).map(([type, { scripts, base }]) => {
    const explanationKey = getExplanationKey(type);
    const explanation = findExplanation(explanationKey);

    const matchedFrameworks: FrameworkFix[] = [];
    if (explanation?.remediation.frameworks) {
      for (const [framework, fix] of Object.entries(explanation.remediation.frameworks)) {
        if (techNames.includes(framework)) {
          matchedFrameworks.push({ framework, slug: slugify(framework), fix });
        }
      }
    }

    return {
      issueType: type,
      scripts,
      isCritical: base.isCritical,
      explanationKey,
      explanation,
      matchedFrameworks,
    };
  });
}

export function classifyFindings(
  httpFindings: string[],
  tlsFindings: string[],
): Record<string, string[]> {
  const classified = classifyByPrefix({
    items: httpFindings,
    getText: (f) => f,
  });
  return {
    ...classified,
    tls: [...tlsFindings],
  };
}

export function buildGroupedAiPromptData(config: {
  targetUrl: string;
  detectedTechs: DetectedTechnology[];
  classifiedFindings: Record<string, string[]>;
}): AiPromptData | null {
  const { targetUrl, detectedTechs, classifiedFindings } = config;

  const allFindings: string[] = [];
  for (const findings of Object.values(classifiedFindings)) {
    allFindings.push(...findings);
  }
  if (allFindings.length === 0) return null;

  const techStackLabel = detectedTechs.map((t) => t.name).join(", ") || "Unknown";

  const sections: string[] = [];
  let counter = 1;
  for (const [key, findings] of Object.entries(classifiedFindings)) {
    if (findings.length === 0) continue;
    const label = SECTION_LABELS[key] ?? key;
    const items = findings.map((f) => `${counter++}. ${f}`).join("\n");
    sections.push(`${label}:\n${items}`);
  }

  const promptText =
`You are a security remediation agent. A security scan was run on ${targetUrl} and found the issues listed below. The detected technology stack is: ${techStackLabel}.

For each issue, provide the exact configuration change or code fix needed for this technology stack, how to verify the fix worked, and any caveats or side effects.

Issues to fix:
${sections.join("\n\n")}`;

  return { promptText, techStackLabel, findings: allFindings };
}

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

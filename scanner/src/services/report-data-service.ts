import type { UnifiedReport, DetectedTechnology } from "@penetragent/shared";
import { findExplanation, SECURITY_EXPLANATIONS, type SecurityExplanation } from "../scanTypes/security-explanations.js";
import { HTTP_SCAN_CONFIG } from "../scanTypes/scan-config.js";
import { computeWorstCaseGrades as computeWorstCaseGradesShared } from "../scanTypes/compute-worst-grades.js";

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

export interface ProcessedReportData {
  targetUrl: string;
  timestamp: string;
  formattedDate: string;
  isMultiPage: boolean;
  totalPages: number;
  redirectChain: string[];
  headerGradeSummary: HeaderGradeSummary;
  issues: AggregatedIssue[];
  matchedFrameworks: { name: string; slug: string }[];
  aiPrompt: AiPromptData | null;
  scannedPages: { url: string; statusCode: number; contentType: string | null }[];
  printChecklist: PrintChecklistItem[];
}

export function slugifyFramework(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function getExplanationKey(issue: string): string {
  if (issue.startsWith("Missing ")) {
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
  const issueMap = new Map<string, { pages: string[] }>();

  for (const page of httpData.pages) {
    for (const grade of page.headerGrades) {
      if (grade.grade === "missing") {
        const key = `Missing ${grade.header} header`;
        if (!issueMap.has(key)) issueMap.set(key, { pages: [] });
        issueMap.get(key)!.pages.push(page.url);
      } else if (grade.grade === "weak") {
        const key = `Weak ${grade.header}: ${grade.reason}`;
        if (!issueMap.has(key)) issueMap.set(key, { pages: [] });
        issueMap.get(key)!.pages.push(page.url);
      }
    }
    for (const leak of page.infoLeakage) {
      const key = `${leak.header} header disclosed: ${leak.value}`;
      if (!issueMap.has(key)) issueMap.set(key, { pages: [] });
      issueMap.get(key)!.pages.push(page.url);
    }
    for (const issue of page.contentIssues) {
      if (!issueMap.has(issue)) issueMap.set(issue, { pages: [] });
      issueMap.get(issue)!.pages.push(page.url);
    }
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

  return Array.from(matched).map((name) => ({ name, slug: slugifyFramework(name) }));
}

export function computeWorstCaseGrades(
  httpData: NonNullable<UnifiedReport["scans"]["http"]>,
): HeaderGradeSummary {
  return computeWorstCaseGradesShared(httpData.pages);
}

export function classifyAndSortIssues(config: {
  issueMap: Map<string, { pages: string[] }>;
  detectedTechs: DetectedTechnology[];
}): AggregatedIssue[] {
  const { issueMap, detectedTechs } = config;
  const techNames = detectedTechs.map((t) => t.name);

  return Array.from(issueMap.entries())
    .sort((a, b) => b[1].pages.length - a[1].pages.length)
    .map(([issue, { pages }]) => {
      const isCritical = HTTP_SCAN_CONFIG.criticalFindingPatterns.some((p) => issue.includes(p));
      const explanationKey = getExplanationKey(issue);
      const explanation = findExplanation(explanationKey);

      const matchedFrameworks: FrameworkFix[] = [];
      if (explanation?.remediation.frameworks) {
        for (const [framework, fix] of Object.entries(explanation.remediation.frameworks)) {
          if (techNames.includes(framework)) {
            matchedFrameworks.push({ framework, slug: slugifyFramework(framework), fix });
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

export function buildPrintChecklist(config: {
  issues: AggregatedIssue[];
  matchedFrameworks: { name: string; slug: string }[];
}): PrintChecklistItem[] {
  const { issues, matchedFrameworks } = config;

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

export function processReportData(report: UnifiedReport): ProcessedReportData {
  const httpData = report.scans.http;

  const issueMap = httpData
    ? aggregateIssues(httpData)
    : new Map<string, { pages: string[] }>();

  const totalPages = httpData?.pages.length ?? 0;
  const isMultiPage = totalPages > 1;
  const matchedFrameworks = collectMatchedFrameworks(report.detectedTechnologies);

  const issues = classifyAndSortIssues({
    issueMap,
    detectedTechs: report.detectedTechnologies,
  });

  const headerGradeSummary = httpData
    ? computeWorstCaseGrades(httpData)
    : { good: 0, weak: 0, missing: 0 };

  const aiPrompt = httpData
    ? buildAiPromptData({
        targetUrl: report.targetUrl,
        detectedTechs: report.detectedTechnologies,
        findings: httpData.findings,
      })
    : null;

  const scannedPages = httpData
    ? httpData.pages.map((p) => ({ url: p.url, statusCode: p.statusCode, contentType: p.contentType }))
    : [];

  const printChecklist = buildPrintChecklist({ issues, matchedFrameworks });

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
    issues,
    matchedFrameworks,
    aiPrompt,
    scannedPages,
    printChecklist,
  };
}

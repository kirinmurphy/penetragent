import fs from "node:fs";
import path from "node:path";
import type { UnifiedReport } from "@penetragent/shared";
import { loadUnifiedReport } from "./unified-report-service.js";
import {
  processReportData,
  type AggregatedIssue,
  type ProcessedReportData,
  type PrintChecklistItem,
  type AiPromptData,
} from "./report-data-service.js";
import { HTML_STYLES } from "./html-report-styles.js";
import { CONTROL_BAR_SCRIPT, COPY_PROMPT_SCRIPT } from "./html-report-scripts.js";

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function renderExplanationContent(issue: AggregatedIssue): string {
  if (!issue.explanation) return "";

  const frameworkFixes = issue.matchedFrameworks
    .map(({ slug, fix }) =>
      `<div class="issue-fix issue-fix-${slug}" style="display:none">
            <pre>${escapeHtml(fix)}</pre>
          </div>`)
    .join("");

  return `
    <div class="issue-details" style="display:none">
      <p>${escapeHtml(issue.explanation.what)}</p>
      <p><strong>Why it matters:</strong> ${escapeHtml(issue.explanation.why)}</p>
    </div>
    <div class="issue-fix issue-fix-generic" style="display:none">
      <pre>${escapeHtml(issue.explanation.remediation.generic)}</pre>
    </div>
    ${frameworkFixes}
  `;
}

function renderControlBar(
  matchedFrameworks: ProcessedReportData["matchedFrameworks"],
): string {
  const fixGroup = matchedFrameworks.length > 0
    ? `<span class="group-label">Suggested Solutions</span>
       <button class="fix-btn" data-fw="generic">Default</button>
       ${matchedFrameworks.map((fw) =>
         `<button class="fix-btn" data-fw="${fw.slug}">${escapeHtml(fw.name)}</button>`
       ).join("")}`
    : `<button class="fix-btn" data-fw="generic">Suggested Solutions</button>`;

  return `
    <div class="control-bar">
      <div class="group">
        <button class="ctrl-btn" id="toggle-details">Show Issue Explanation</button>
      </div>
      <div class="group">
        ${fixGroup}
      </div>
    </div>
  `;
}

function renderIssueCards(
  issues: AggregatedIssue[],
  isMultiPage: boolean,
  totalPages: number,
): string {
  if (issues.length === 0) return "";

  return issues
    .map((issue) => {
      const explanationContent = renderExplanationContent(issue);

      let pageBadge = "";
      let pageList = "";
      if (isMultiPage) {
        if (issue.pages.length === totalPages) {
          pageBadge = `<span class="badge count clickable" onclick="openScannedPages()">All pages</span>`;
        } else {
          pageBadge = `<span class="badge count clickable" onclick="togglePages(this)">${issue.pages.length} page${issue.pages.length !== 1 ? "s" : ""} <span class="caret">&#9656;</span></span>`;
          pageList = `<div class="issue-card-pages"><ul>${issue.pages.map((url) => `<li>${escapeHtml(url)}</li>`).join("")}</ul></div>`;
        }
      }

      return `
        <div class="issue-card">
          <div class="issue-card-header${issue.isCritical ? " critical-issue" : ""}">
            <span>${escapeHtml(issue.issue)}</span>
            ${pageBadge}
          </div>
          ${explanationContent ? `<div class="issue-card-body">${explanationContent}</div>` : ""}
          ${pageList}
        </div>
      `;
    })
    .join("");
}

function renderHeadersSection(data: ProcessedReportData): string {
  if (data.totalPages === 0) return "";

  const { good, weak, missing } = data.headerGradeSummary;

  const summaryCards = `
    <div class="summary">
      <div class="summary-card good">
        <h4>Good</h4>
        <div class="value">${good}</div>
      </div>
      <div class="summary-card">
        <h4>Weak</h4>
        <div class="value">${weak}</div>
      </div>
      <div class="summary-card critical">
        <h4>Missing</h4>
        <div class="value">${missing}</div>
      </div>
    </div>
  `;

  const redirectInfo = data.redirectChain.length > 1
    ? `<div class="url-info">
        <p><strong>Redirect Chain:</strong> ${data.redirectChain.map(escapeHtml).join(" &rarr; ")}</p>
       </div>`
    : "";

  const issueCards = renderIssueCards(data.issues, data.isMultiPage, data.totalPages);

  const scannedPagesTable = data.isMultiPage
    ? `
    <details id="scanned-pages">
      <summary>Scanned Pages (${data.totalPages})</summary>
      <div class="explanation">
        <table>
          <thead>
            <tr><th>URL</th><th>Status</th><th>Content Type</th></tr>
          </thead>
          <tbody>
            ${data.scannedPages
              .map((page) => `
                <tr>
                  <td>${escapeHtml(page.url)}</td>
                  <td>${page.statusCode}</td>
                  <td>${page.contentType ? escapeHtml(page.contentType) : "<em>Unknown</em>"}</td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </div>
    </details>
  `
    : "";

  return `
    <div class="section">
      <h2>Security Headers</h2>
      ${summaryCards}
      ${redirectInfo}
      ${issueCards}
      ${scannedPagesTable}
    </div>
  `;
}

function renderAiPromptSection(aiPrompt: AiPromptData | null): string {
  if (!aiPrompt) return "";

  return `
    <div class="section">
      <div class="ai-prompt-collapsible">
        <div class="ai-prompt-header">
          <span>Prompt for AI Agent Fix</span>
          <button class="copy-btn" onclick="copyPrompt()">Copy to clipboard</button>
        </div>
        <p class="ai-prompt-description">Copy this prompt into an AI assistant to get specific configuration fixes for your technology stack.</p>
        <div class="ai-prompt-body" id="ai-prompt-text">${escapeHtml(aiPrompt.promptText)}</div>
      </div>
    </div>
    ${COPY_PROMPT_SCRIPT}
  `;
}

function renderPrintChecklistBar(
  printChecklist: PrintChecklistItem[],
  matchedFrameworks: ProcessedReportData["matchedFrameworks"],
): string {
  if (printChecklist.length === 0) return "";

  const buttons = matchedFrameworks.length > 0
    ? [
        `<button class="fix-btn print-btn" data-fw="generic">Default</button>`,
        ...matchedFrameworks.map((fw) =>
          `<button class="fix-btn print-btn" data-fw="${fw.slug}">${escapeHtml(fw.name)}</button>`
        ),
      ].join("")
    : `<button class="fix-btn print-btn" data-fw="generic">Print</button>`;

  return `
    <div class="print-checklist-bar">
      <span class="bar-title">Print Resolution Checklist</span>
      <div class="group">
        ${buttons}
      </div>
    </div>
  `;
}

function renderPrintView(data: ProcessedReportData): string {
  if (data.printChecklist.length === 0) return "";

  const subtitles = [
    `<p class="print-subtitle print-subtitle-generic">Recommended Fixes</p>`,
    ...data.matchedFrameworks.map((fw) =>
      `<p class="print-subtitle print-subtitle-${fw.slug}" style="display:none">Recommended Fixes for ${escapeHtml(fw.name)}</p>`
    ),
  ].join("\n");

  const items = data.printChecklist.map((item) => {
    const frameworkFixes = item.frameworkFixes
      .map(({ slug, fix }) =>
        `<div class="print-item-fix print-fix-${slug}" style="display:none">${escapeHtml(fix)}</div>`)
      .join("");

    return `
      <div class="print-item">
        <input type="checkbox">
        <div class="print-item-label">
          <div>${escapeHtml(item.issue)}</div>
          ${item.genericFix ? `<div class="print-item-fix print-fix-generic">${escapeHtml(item.genericFix)}</div>` : ""}
          ${frameworkFixes}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="print-view">
      <h2>Security Scan Resolution Checklist</h2>
      <p class="print-meta">${escapeHtml(data.targetUrl)} | ${data.formattedDate}</p>
      ${subtitles}
      ${items}
    </div>
  `;
}

export function generateHtmlReport(report: UnifiedReport): string {
  const data = processReportData(report);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Scan Report - ${escapeHtml(data.targetUrl)}</title>
  <style>${HTML_STYLES}</style>
</head>
<body>
  <div class="container">
    <h1>Security Scan Report</h1>
    <div class="meta">
      <p><a href="${escapeHtml(data.targetUrl)}" target="_blank" rel="noopener">${escapeHtml(data.targetUrl)}</a></p>
      <p>${formatTimestamp(data.timestamp)}</p>
    </div>

    ${renderControlBar(data.matchedFrameworks)}
    ${renderHeadersSection(data)}
    ${renderPrintChecklistBar(data.printChecklist, data.matchedFrameworks)}
    ${renderAiPromptSection(data.aiPrompt)}
    ${renderPrintView(data)}
  </div>
  ${CONTROL_BAR_SCRIPT}
</body>
</html>`;
}

export function writeHtmlReport(
  reportsDir: string,
  jobId: string,
  targetId: string,
): void {
  const report = loadUnifiedReport(reportsDir, jobId);
  if (!report) {
    throw new Error(`Unified report not found for job ${jobId}`);
  }

  const html = generateHtmlReport(report);
  const jobDir = path.join(reportsDir, jobId);
  const date = report.timestamp ? report.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const htmlPath = path.join(jobDir, `report-${targetId}-${date}.html`);

  fs.writeFileSync(htmlPath, html, "utf-8");
}

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

const HTML_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f5f5f5;
    padding: 20px;
  }
  .container {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  h1 {
    color: #2c3e50;
    margin-bottom: 10px;
    font-size: 2.5em;
  }
  h2 {
    color: #34495e;
    margin: 30px 0 15px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid #3498db;
    font-size: 1.8em;
  }
  h3 {
    color: #555;
    margin: 20px 0 10px 0;
    font-size: 1.3em;
  }
  .meta {
    color: #7f8c8d;
    margin-bottom: 20px;
    padding: 15px;
    background: #ecf0f1;
    border-radius: 4px;
  }
  .meta p {
    margin: 5px 0;
  }
  .meta a {
    color: #2980b9;
    text-decoration: none;
    font-size: 1.3em;
    font-weight: 500;
  }
  .meta a:hover {
    text-decoration: underline;
  }
  .control-bar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: #2c3e50;
    color: white;
    padding: 10px 16px;
    border-radius: 6px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    flex-wrap: wrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .control-bar .group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .control-bar .group-label {
    font-size: 0.85em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.8;
  }
  .ctrl-btn, .fix-btn {
    padding: 6px 14px;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 4px;
    background: transparent;
    color: white;
    cursor: pointer;
    font-size: 0.85em;
    font-weight: 600;
    transition: background 0.15s, border-color 0.15s;
  }
  .ctrl-btn:hover, .fix-btn:hover {
    background: rgba(255,255,255,0.15);
  }
  .ctrl-btn.active, .fix-btn.active {
    background: #3498db;
    border-color: #3498db;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin: 20px 0;
  }
  .summary-card {
    padding: 20px;
    border-radius: 6px;
    background: #f8f9fa;
    border-left: 4px solid #3498db;
  }
  .summary-card.critical {
    border-left-color: #e74c3c;
    background: #fef5f5;
  }
  .summary-card.good {
    border-left-color: #27ae60;
    background: #f0faf4;
  }
  .summary-card h4 {
    font-size: 0.9em;
    color: #7f8c8d;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  .summary-card .value {
    font-size: 2em;
    font-weight: bold;
    color: #2c3e50;
  }
  .findings {
    margin: 20px 0;
  }
  .finding {
    padding: 12px 15px;
    margin: 8px 0;
    border-radius: 4px;
    background: #fff3cd;
    border-left: 4px solid #ffc107;
  }
  .finding.critical {
    background: #f8d7da;
    border-left-color: #dc3545;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }
  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  th {
    background: #34495e;
    color: white;
    font-weight: 600;
  }
  tr:hover {
    background: #f8f9fa;
  }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85em;
    font-weight: 600;
  }
  .badge.count {
    background: #e2e3e5;
    color: #383d41;
    margin-left: 8px;
  }
  .badge.count.clickable {
    cursor: pointer;
    user-select: none;
  }
  .badge.count.clickable:hover {
    background: #d0d2d5;
  }
  .badge .caret {
    font-size: 0.75em;
    margin-left: 4px;
    display: inline-block;
    transition: transform 0.15s;
  }
  .badge .caret.open {
    transform: rotate(90deg);
  }
  .issue-card-pages {
    padding: 8px 15px;
    background: #f8f9fa;
    border-top: 1px solid #e0e0e0;
    font-size: 0.85em;
    display: none;
  }
  .issue-card-pages ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .issue-card-pages li {
    padding: 3px 0;
    color: #555;
    font-family: 'Courier New', monospace;
  }
  .url-info {
    background: #e8f4f8;
    padding: 15px;
    border-radius: 4px;
    margin: 15px 0;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }
  .section {
    margin: 40px 0;
  }
  code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }
  .empty-state {
    text-align: center;
    padding: 40px;
    color: #95a5a6;
    font-style: italic;
  }
  details {
    margin: 8px 0;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }
  details summary {
    padding: 10px 15px;
    background: #f8f9fa;
    cursor: pointer;
    font-weight: 600;
    color: #34495e;
    user-select: none;
  }
  details summary:hover {
    background: #ecf0f1;
  }
  details[open] summary {
    border-bottom: 1px solid #e0e0e0;
  }
  .explanation {
    padding: 15px;
    background: #fafbfc;
    font-size: 0.9em;
    line-height: 1.7;
  }
  .issue-details {
    padding: 12px 15px;
    background: #fafbfc;
    font-size: 0.9em;
    line-height: 1.7;
  }
  .issue-details p {
    color: #555;
    margin-bottom: 4px;
  }
  .issue-details p:last-child {
    margin-bottom: 0;
  }
  .issue-fix {
    padding: 12px 15px;
    background: #f0f7ff;
  }
  .issue-fix pre {
    background: #2d2d2d;
    color: #f8f8f2;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.9em;
    margin: 0;
  }
  .issue-card {
    margin: 12px 0;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
  }
  .issue-card-header {
    padding: 12px 15px;
    background: #fff3cd;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .issue-card-header.critical-issue {
    background: #f8d7da;
  }
  .issue-card-body {
    padding: 0;
  }
  .ai-prompt-body {
    padding: 15px;
    background: #f8f9fa;
    font-family: 'Courier New', monospace;
    font-size: 0.85em;
    white-space: pre-wrap;
    line-height: 1.5;
    max-height: 400px;
    overflow-y: auto;
  }
  .copy-btn {
    padding: 6px 14px;
    background: white;
    color: #3498db;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85em;
  }
  .copy-btn:hover {
    background: #ecf0f1;
  }
  .ai-prompt-collapsible {
    margin: 30px 0;
    border: 2px solid #3498db;
    border-radius: 8px;
    overflow: hidden;
  }
  .ai-prompt-header {
    padding: 12px 15px;
    background: #3498db;
    color: white;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.3);
  }
  .ai-prompt-description {
    padding: 10px 15px;
    color: #555;
    font-size: 0.9em;
    border-bottom: 1px solid #e0e0e0;
  }
  .print-checklist-bar {
    background: #2c3e50;
    color: white;
    padding: 10px 16px;
    border-radius: 6px;
    margin: 30px 0 20px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .print-checklist-bar .bar-title {
    font-weight: 600;
    font-size: 1em;
  }
  .print-checklist-bar .group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .print-view {
    display: none;
  }
  .print-view .print-meta {
    color: #7f8c8d;
    margin-bottom: 15px;
  }
  .print-view .print-subtitle {
    color: #555;
    font-weight: 600;
    margin-bottom: 15px;
    font-size: 1.1em;
  }
  .print-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }
  .print-item input[type="checkbox"] {
    margin-top: 4px;
    width: 16px;
    height: 16px;
  }
  .print-item-label {
    flex: 1;
  }
  .print-item-fix {
    font-family: 'Courier New', monospace;
    font-size: 0.85em;
    color: #555;
    margin-top: 4px;
  }
  @media print {
    body { background: white !important; padding: 0 !important; }
    .container { box-shadow: none !important; padding: 15px !important; }
    .container > *:not(.print-view) { display: none !important; }
    .print-view { display: block !important; }
    .print-item { page-break-inside: avoid; }
  }
`;

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
    <script>
    function copyPrompt() {
      var text = document.getElementById('ai-prompt-text').textContent;
      var btn = document.querySelector('.copy-btn');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = 'Copy to clipboard'; }, 2000);
        }, function() {
          fallbackCopy(text, btn);
        });
      } else {
        fallbackCopy(text, btn);
      }
    }
    function fallbackCopy(text, btn) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        btn.textContent = 'Copied!';
      } catch (e) {
        btn.textContent = 'Copy failed';
      }
      document.body.removeChild(ta);
      setTimeout(function() { btn.textContent = 'Copy to clipboard'; }, 2000);
    }
    </script>
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

const CONTROL_BAR_SCRIPT = `
  <script>
  (function() {
    var detailsBtn = document.getElementById('toggle-details');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', function() {
        var showing = this.classList.toggle('active');
        this.textContent = showing ? 'Hide Issue Explanation' : 'Show Issue Explanation';
        var items = document.querySelectorAll('.issue-details');
        for (var i = 0; i < items.length; i++) {
          items[i].style.display = showing ? 'block' : 'none';
        }
      });
    }
    var fixBtns = document.querySelectorAll('.control-bar .fix-btn');
    for (var i = 0; i < fixBtns.length; i++) {
      fixBtns[i].addEventListener('click', function() {
        var fw = this.getAttribute('data-fw');
        var wasActive = this.classList.contains('active');
        var allFixBtns = document.querySelectorAll('.control-bar .fix-btn');
        for (var j = 0; j < allFixBtns.length; j++) {
          allFixBtns[j].classList.remove('active');
        }
        var allFixes = document.querySelectorAll('.issue-fix');
        for (var j = 0; j < allFixes.length; j++) {
          allFixes[j].style.display = 'none';
        }
        if (wasActive) return;
        this.classList.add('active');
        var matches = document.querySelectorAll('.issue-fix-' + fw);
        for (var j = 0; j < matches.length; j++) {
          matches[j].style.display = 'block';
        }
      });
    }
    window.togglePages = function(el) {
      var card = el.closest('.issue-card');
      var pageDiv = card.querySelector('.issue-card-pages');
      var caret = el.querySelector('.caret');
      if (!pageDiv) return;
      var isOpen = pageDiv.style.display === 'block';
      pageDiv.style.display = isOpen ? 'none' : 'block';
      if (caret) caret.classList.toggle('open', !isOpen);
    };
    window.openScannedPages = function() {
      var details = document.getElementById('scanned-pages');
      if (details) {
        details.open = true;
        details.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    var printBtns = document.querySelectorAll('.print-btn');
    for (var i = 0; i < printBtns.length; i++) {
      printBtns[i].addEventListener('click', function() {
        var fw = this.getAttribute('data-fw');
        var subtitles = document.querySelectorAll('.print-subtitle');
        for (var j = 0; j < subtitles.length; j++) {
          subtitles[j].style.display = 'none';
        }
        var fixes = document.querySelectorAll('.print-item-fix');
        for (var j = 0; j < fixes.length; j++) {
          fixes[j].style.display = 'none';
        }
        var activeSubtitle = document.querySelector('.print-subtitle-' + fw);
        if (activeSubtitle) activeSubtitle.style.display = 'block';
        var activeFixes = document.querySelectorAll('.print-fix-' + fw);
        for (var j = 0; j < activeFixes.length; j++) {
          activeFixes[j].style.display = 'block';
        }
        window.print();
      });
    }
  })();
  </script>
`;

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

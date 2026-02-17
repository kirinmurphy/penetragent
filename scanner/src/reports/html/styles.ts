export const HTML_STYLES = `
  :root {
    --color-body-text: #333;
    --color-body-bg: #f5f5f5;
    --color-container-bg: white;
    --color-container-shadow: rgba(0,0,0,0.1);

    --color-h1: #2c3e50;
    --color-h2: #34495e;
    --color-h2-border: #3498db;
    --color-h3: #555;

    --color-meta-text: #7f8c8d;
    --color-meta-bg: #ecf0f1;
    --color-meta-link: #2980b9;

    --color-control-bar-bg: #2c3e50;
    --color-control-bar-text: white;
    --color-control-bar-border: rgba(255,255,255,0.3);
    --color-control-bar-shadow: rgba(0,0,0,0.15);
    --color-control-bar-hover: rgba(255,255,255,0.15);
    --color-control-bar-active: #3498db;

    --color-summary-bg: #f8f9fa;
    --color-summary-border: #3498db;
    --color-summary-label: #7f8c8d;
    --color-summary-value: #2c3e50;
    --color-summary-good-border: #27ae60;
    --color-summary-good-bg: #f0faf4;
    --color-summary-critical-border: #e74c3c;
    --color-summary-critical-bg: #fef5f5;

    --color-finding-bg: #fff3cd;
    --color-finding-border: #ffc107;
    --color-finding-critical-bg: #f8d7da;
    --color-finding-critical-border: #dc3545;

    --color-table-header-bg: #34495e;
    --color-table-header-text: white;
    --color-table-border: #ddd;
    --color-table-hover: #f8f9fa;

    --color-badge-bg: #e2e3e5;
    --color-badge-text: #383d41;
    --color-badge-hover: #d0d2d5;

    --color-issue-card-border: #e0e0e0;
    --color-issue-card-header-bg: #fff3cd;
    --color-issue-card-critical-bg: #f8d7da;
    --color-issue-card-pages-bg: #f8f9fa;
    --color-issue-card-pages-text: #555;

    --color-details-border: #e0e0e0;
    --color-details-bg: #f8f9fa;
    --color-details-text: #34495e;
    --color-details-hover: #ecf0f1;

    --color-explanation-bg: #fafbfc;
    --color-issue-details-bg: #fafbfc;
    --color-issue-details-text: #555;

    --color-issue-fix-bg: #f0f7ff;
    --color-issue-fix-code-bg: #2d2d2d;
    --color-issue-fix-code-text: #f8f8f2;

    --color-inline-code-bg: #f4f4f4;

    --color-url-info-bg: #e8f4f8;

    --color-ai-prompt-accent: #3498db;
    --color-ai-prompt-body-bg: #f8f9fa;
    --color-ai-prompt-desc-text: #555;
    --color-ai-prompt-desc-border: #e0e0e0;

    --color-copy-btn-bg: white;
    --color-copy-btn-text: #3498db;
    --color-copy-btn-hover: #ecf0f1;

    --color-empty-state: #95a5a6;
    --color-tls-subtitle: #888;

    --color-print-bar-bg: #2c3e50;
    --color-print-bar-text: white;
    --color-print-meta: #7f8c8d;
    --color-print-subtitle: #555;
    --color-print-item-border: #eee;
    --color-print-fix-text: #555;
  }

  @media screen and (prefers-color-scheme: dark) {
    :root {
      --color-body-text: #e8e8e8;
      --color-body-bg: #131316;
      --color-container-bg: #1a1a1e;
      --color-container-shadow: rgba(0,0,0,0.6);

      --color-h1: #e0e0e0;
      --color-h2: #c0c4cc;
      --color-h2-border: #4a7a9b;
      --color-h3: #a0a4ac;

      --color-meta-text: #8890a0;
      --color-meta-bg: #1e1e24;
      --color-meta-link: #6ba3c8;

      --color-control-bar-bg: #1e1e24;
      --color-control-bar-text: #e0e0e0;
      --color-control-bar-border: rgba(255,255,255,0.18);
      --color-control-bar-shadow: rgba(0,0,0,0.6);
      --color-control-bar-hover: rgba(255,255,255,0.1);
      --color-control-bar-active: #4a7a9b;

      --color-summary-bg: #1e1e24;
      --color-summary-border: #4a7a9b;
      --color-summary-label: #8890a0;
      --color-summary-value: #e0e0e0;
      --color-summary-good-border: #3daf6a;
      --color-summary-good-bg: #152418;
      --color-summary-critical-border: #d0524f;
      --color-summary-critical-bg: #2a161a;

      --color-finding-bg: #2e280f;
      --color-finding-border: #c49b30;
      --color-finding-critical-bg: #2e151a;
      --color-finding-critical-border: #c45050;

      --color-table-header-bg: #1e1e24;
      --color-table-header-text: #e0e0e0;
      --color-table-border: #2a2a32;
      --color-table-hover: #222228;

      --color-badge-bg: #2a2a32;
      --color-badge-text: #c0c4cc;
      --color-badge-hover: #32323a;

      --color-issue-card-border: #2a2a32;
      --color-issue-card-header-bg: #2e280f;
      --color-issue-card-critical-bg: #2e151a;
      --color-issue-card-pages-bg: #1e1e24;
      --color-issue-card-pages-text: #a0a4ac;

      --color-details-border: #2a2a32;
      --color-details-bg: #1e1e24;
      --color-details-text: #c0c4cc;
      --color-details-hover: #262630;

      --color-explanation-bg: #1e1e24;
      --color-issue-details-bg: #1e1e24;
      --color-issue-details-text: #a0a4ac;

      --color-issue-fix-bg: #1c1c22;
      --color-issue-fix-code-bg: #131316;
      --color-issue-fix-code-text: #d4d8e0;

      --color-inline-code-bg: #22222a;

      --color-url-info-bg: #1c1c22;

      --color-ai-prompt-accent: #4a7a9b;
      --color-ai-prompt-body-bg: #1e1e24;
      --color-ai-prompt-desc-text: #a0a4ac;
      --color-ai-prompt-desc-border: #2a2a32;

      --color-copy-btn-bg: #22222a;
      --color-copy-btn-text: #6ba3c8;
      --color-copy-btn-hover: #2a2a32;

      --color-empty-state: #707480;
      --color-tls-subtitle: #8890a0;

      --color-print-bar-bg: #1e1e24;
      --color-print-bar-text: #e0e0e0;
      --color-print-meta: #8890a0;
      --color-print-subtitle: #a0a4ac;
      --color-print-item-border: #2a2a32;
      --color-print-fix-text: #a0a4ac;
    }
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: var(--color-body-text);
    background: var(--color-body-bg);
    padding: 20px;
  }
  .container {
    max-width: 1200px;
    margin: 0 auto;
    background: var(--color-container-bg);
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 4px var(--color-container-shadow);
  }
  h1 {
    color: var(--color-h1);
    margin-bottom: 10px;
    font-size: 2.5em;
  }
  h2 {
    color: var(--color-h2);
    margin: 30px 0 15px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--color-h2-border);
    font-size: 1.8em;
  }
  h3 {
    color: var(--color-h3);
    margin: 20px 0 10px 0;
    font-size: 1.3em;
  }
  .meta {
    color: var(--color-meta-text);
    margin-bottom: 20px;
    padding: 15px;
    background: var(--color-meta-bg);
    border-radius: 4px;
  }
  .meta p {
    margin: 5px 0;
  }
  .meta a {
    color: var(--color-meta-link);
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
    background: var(--color-control-bar-bg);
    color: var(--color-control-bar-text);
    padding: 10px 16px;
    border-radius: 6px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    flex-wrap: wrap;
    box-shadow: 0 2px 8px var(--color-control-bar-shadow);
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
    padding: 8px 18px;
    border: 1px solid rgba(255,255,255,0.4);
    border-radius: 5px;
    background: rgba(255,255,255,0.08);
    color: var(--color-control-bar-text);
    cursor: pointer;
    font-size: 0.88em;
    font-weight: 600;
    letter-spacing: 0.3px;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  }
  .ctrl-btn:hover, .fix-btn:hover {
    background: rgba(255,255,255,0.18);
    border-color: rgba(255,255,255,0.5);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
  .ctrl-btn.active, .fix-btn.active {
    background: var(--color-control-bar-active);
    border-color: var(--color-control-bar-active);
    box-shadow: 0 1px 6px rgba(52,152,219,0.35);
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
    margin: 15px 0;
  }
  .summary-card {
    padding: 14px 16px;
    border-radius: 6px;
    background: var(--color-summary-bg);
    border-left: 4px solid var(--color-summary-border);
  }
  .summary-card.critical {
    border-left-color: var(--color-summary-critical-border);
    background: var(--color-summary-critical-bg);
  }
  .summary-card.good {
    border-left-color: var(--color-summary-good-border);
    background: var(--color-summary-good-bg);
  }
  .summary-card h4 {
    font-size: 0.8em;
    color: var(--color-summary-label);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .summary-card .value {
    font-size: 1.6em;
    font-weight: bold;
    color: var(--color-summary-value);
  }
  .findings {
    margin: 20px 0;
  }
  .finding {
    padding: 12px 15px;
    margin: 8px 0;
    border-radius: 4px;
    background: var(--color-finding-bg);
    border-left: 4px solid var(--color-finding-border);
  }
  .finding.critical {
    background: var(--color-finding-critical-bg);
    border-left-color: var(--color-finding-critical-border);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }
  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--color-table-border);
  }
  th {
    background: var(--color-table-header-bg);
    color: var(--color-table-header-text);
    font-weight: 600;
  }
  tr:hover {
    background: var(--color-table-hover);
  }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85em;
    font-weight: 600;
  }
  .badge.count {
    background: var(--color-badge-bg);
    color: var(--color-badge-text);
    margin-left: 8px;
  }
  .badge-btn {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border: 1px solid var(--color-control-bar-border);
    border-radius: 20px;
    background: var(--color-control-bar-bg);
    color: var(--color-control-bar-text);
    cursor: pointer;
    font-size: 0.82em;
    font-weight: 600;
    letter-spacing: 0.3px;
    user-select: none;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    white-space: nowrap;
  }
  .badge-btn:hover {
    background: var(--color-control-bar-hover);
    border-color: rgba(255,255,255,0.5);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
  .badge-btn .caret {
    font-size: 0.7em;
    display: inline-block;
    transition: transform 0.2s;
  }
  .badge-btn .caret.open {
    transform: rotate(180deg);
  }
  .issue-card-pages {
    padding: 8px 15px;
    background: var(--color-issue-card-pages-bg);
    border-top: 1px solid var(--color-issue-card-border);
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
    color: var(--color-issue-card-pages-text);
    font-family: 'Courier New', monospace;
  }
  .url-info {
    background: var(--color-url-info-bg);
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
    background: var(--color-inline-code-bg);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }
  .empty-state {
    padding: 8px 0;
    color: var(--color-empty-state);
    font-size: 1.05em;
  }
  details {
    margin: 8px 0;
    border: 1px solid var(--color-details-border);
    border-radius: 4px;
    overflow: hidden;
  }
  details summary {
    padding: 10px 15px;
    background: var(--color-details-bg);
    cursor: pointer;
    font-weight: 600;
    color: var(--color-details-text);
    user-select: none;
  }
  details summary:hover {
    background: var(--color-details-hover);
  }
  details[open] summary {
    border-bottom: 1px solid var(--color-details-border);
  }
  .explanation {
    padding: 15px;
    background: var(--color-explanation-bg);
    font-size: 0.9em;
    line-height: 1.7;
  }
  .issue-details {
    padding: 12px 15px;
    background: var(--color-issue-details-bg);
    font-size: 0.9em;
    line-height: 1.7;
  }
  .issue-details p {
    color: var(--color-issue-details-text);
    margin-bottom: 4px;
  }
  .issue-details p:last-child {
    margin-bottom: 0;
  }
  .issue-fix {
    padding: 12px 15px;
    background: var(--color-issue-fix-bg);
  }
  .issue-fix pre {
    background: var(--color-issue-fix-code-bg);
    color: var(--color-issue-fix-code-text);
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.9em;
    margin: 0;
  }
  .issue-card {
    margin: 12px 0;
    border: 1px solid var(--color-issue-card-border);
    border-radius: 6px;
    overflow: hidden;
  }
  .issue-card-header {
    padding: 12px 15px;
    background: var(--color-issue-card-header-bg);
    border-bottom: 1px solid var(--color-issue-card-border);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .issue-card-header > span:not(.badge-btn) {
    flex: 1;
  }
  .issue-card-header .issue-icon {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
  }
  .issue-card-header.critical-issue {
    background: var(--color-issue-card-critical-bg);
  }
  .issue-card-body {
    padding: 0;
  }
  .ai-prompt-body {
    padding: 15px;
    background: var(--color-ai-prompt-body-bg);
    font-family: 'Courier New', monospace;
    font-size: 0.85em;
    white-space: pre-wrap;
    line-height: 1.5;
    max-height: 400px;
    overflow-y: auto;
  }
  .copy-btn {
    padding: 6px 14px;
    background: var(--color-copy-btn-bg);
    color: var(--color-copy-btn-text);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85em;
  }
  .copy-btn:hover {
    background: var(--color-copy-btn-hover);
  }
  .ai-prompt-collapsible {
    margin: 30px 0;
    border: 2px solid var(--color-ai-prompt-accent);
    border-radius: 8px;
    overflow: hidden;
  }
  .ai-prompt-header {
    padding: 12px 15px;
    background: var(--color-ai-prompt-accent);
    color: white;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.3);
  }
  .ai-prompt-description {
    padding: 10px 15px;
    color: var(--color-ai-prompt-desc-text);
    font-size: 0.9em;
    border-bottom: 1px solid var(--color-ai-prompt-desc-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .ai-copy-btn {
    background: var(--color-control-bar-bg);
    color: var(--color-control-bar-text);
    border: 1px solid rgba(255,255,255,0.4);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ai-copy-btn:hover {
    background: var(--color-control-bar-bg);
    border-color: rgba(255,255,255,0.5);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    opacity: 0.9;
  }
  .print-checklist-bar {
    background: var(--color-ai-prompt-accent);
    color: var(--color-print-bar-text);
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
    color: var(--color-print-meta);
    margin-bottom: 15px;
  }
  .print-view .print-subtitle {
    color: var(--color-print-subtitle);
    font-weight: 600;
    margin-bottom: 15px;
    font-size: 1.1em;
  }
  .print-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-print-item-border);
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
    color: var(--color-print-fix-text);
    margin-top: 4px;
  }
  .print-section-header {
    color: var(--color-h2);
    font-size: 1.1em;
    margin: 20px 0 8px 0;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--color-print-item-border);
  }
  .tls-subtitle {
    color: var(--color-tls-subtitle);
    margin-bottom: 1rem;
  }
  @media print {
    body { background: white !important; padding: 0 !important; }
    .container { box-shadow: none !important; padding: 15px !important; }
    .container > *:not(.print-view) { display: none !important; }
    .print-view { display: block !important; }
    .print-item { page-break-inside: avoid; }
  }
`;

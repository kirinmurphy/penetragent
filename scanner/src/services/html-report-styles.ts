export const HTML_STYLES = `
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

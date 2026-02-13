const FIELD_LABELS: Record<string, string> = {
  good: "Good",
  weak: "Weak",
  missing: "Missing",
  infoLeakage: "Info Leakage",
  pagesScanned: "Pages Scanned",
  issuesFound: "Issues Found",
  criticalFindings: "Critical Findings",
};

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key;
}

export function formatSummary(
  summary: Record<string, unknown>,
  indent = "  ",
): string[] {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(summary)) {
    if (key === "criticalFindings" && Array.isArray(value) && value.length > 0) {
      lines.push("");
      lines.push(...formatCriticalFindings(value, indent));
      continue;
    }

    if (Array.isArray(value)) {
      if (key === "criticalFindings") continue;
      lines.push(`${indent}${getFieldLabel(key)}: ${value.join(", ") || "none"}`);
      continue;
    }

    if (typeof value === "object" && value !== null) {
      lines.push(`${indent}${getFieldLabel(key)}:`);
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (nestedKey === "criticalFindings") {
          if (Array.isArray(nestedValue) && nestedValue.length > 0) {
            lines.push(...formatCriticalFindings(nestedValue, `${indent}  `));
          }
        } else if (Array.isArray(nestedValue)) {
          lines.push(`${indent}  ${getFieldLabel(nestedKey)}: ${nestedValue.join(", ") || "none"}`);
        } else {
          lines.push(`${indent}  ${getFieldLabel(nestedKey)}: ${nestedValue}`);
        }
      }
      continue;
    }

    lines.push(`${indent}${getFieldLabel(key)}: ${value}`);
  }

  return lines;
}

function formatCriticalFindings(findings: unknown[], indent: string): string[] {
  if (findings.length === 1) {
    return [`${indent}Critical Findings: ${findings[0]}`];
  }

  const lines = [`${indent}Critical Findings:`];
  for (const finding of findings) {
    lines.push(`${indent}  • ${finding}`);
  }
  return lines;
}

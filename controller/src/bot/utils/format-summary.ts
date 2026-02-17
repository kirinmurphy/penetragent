const FIELD_LABELS: Record<string, string> = {
  good: "Good",
  weak: "Weak",
  missing: "Missing",
  infoLeakage: "Info Leakage",
  pagesScanned: "Pages Scanned",
  issuesFound: "Issues Found",
  criticalFindings: "Critical Issues",
  http: "HTTP Analysis",
  tls: "SSL/TLS Analysis",
};

export function formatSummary(
  summary: Record<string, unknown>,
  indent = "  ",
): string[] {
  const prepared = prepareSummary(summary);
  return formatEntries(prepared, indent);
}

function prepareSummary(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key === "host") continue;

    if (key === "criticalFindings") {
      if (Array.isArray(value) && value.length > 0) {
        result.criticalFindings = value.length;
      }
      continue;
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = prepareSummary(value as Record<string, unknown>);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function formatEntries(obj: Record<string, unknown>, indent: string): string[] {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(
        `${indent}${getFieldLabel(key)}: ${value.join(", ") || "none"}`,
      );
      continue;
    }

    if (typeof value === "object" && value !== null) {
      lines.push(`${indent}${getFieldLabel(key)}:`);
      lines.push(
        ...formatEntries(value as Record<string, unknown>, `${indent}  `),
      );
      continue;
    }

    lines.push(`${indent}${getFieldLabel(key)}: ${value}`);
  }

  return lines;
}

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key;
}

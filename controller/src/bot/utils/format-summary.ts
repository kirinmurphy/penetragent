export function formatSummary(
  summary: Record<string, unknown>,
  indent = "  ",
): string[] {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(summary)) {
    if (key === "criticalFindings" && Array.isArray(value) && value.length > 0) {
      lines.push(...formatCriticalFindings(value, indent));
      continue;
    }

    if (Array.isArray(value)) {
      lines.push(`${indent}${key}: ${value.join(", ") || "none"}`);
      continue;
    }

    if (typeof value === "object" && value !== null) {
      lines.push(`${indent}${key}:`);
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        lines.push(`${indent}  ${nestedKey}: ${nestedValue}`);
      }
      continue;
    }

    lines.push(`${indent}${key}: ${value}`);
  }

  return lines;
}

function formatCriticalFindings(findings: unknown[], indent: string): string[] {
  if (findings.length === 1) {
    return [`${indent}criticalFindings: ${findings[0]}`];
  }

  const lines = ["", "Critical Findings:"];
  for (const finding of findings) {
    lines.push(`  • ${finding}`);
  }
  return lines;
}

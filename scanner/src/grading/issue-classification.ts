export const ISSUE_CATEGORY_PREFIXES = {
  cookies: ["Missing HttpOnly", "Missing Secure flag", "Missing SameSite", "SameSite=None"],
  scripts: ["Missing Subresource Integrity", "Known vulnerable library"],
  cors: ["CORS", "Wildcard CORS"],
} as const;

export type IssueCategory = "headers" | "cookies" | "scripts" | "cors";

export const SECTION_LABELS: Record<string, string> = {
  headers: "Security Headers",
  cookies: "Cookie Security",
  scripts: "Script & Dependency Security",
  cors: "CORS Configuration",
  tls: "SSL/TLS",
};

export function classifyByPrefix<T>(config: {
  items: T[];
  getText: (item: T) => string;
}): Record<IssueCategory, T[]> {
  const { items, getText } = config;
  const result: Record<IssueCategory, T[]> = {
    headers: [],
    cookies: [],
    scripts: [],
    cors: [],
  };

  for (const item of items) {
    const text = getText(item);
    if (ISSUE_CATEGORY_PREFIXES.cookies.some((p) => text.startsWith(p))) {
      result.cookies.push(item);
    } else if (ISSUE_CATEGORY_PREFIXES.scripts.some((p) => text.startsWith(p))) {
      result.scripts.push(item);
    } else if (ISSUE_CATEGORY_PREFIXES.cors.some((p) => text.startsWith(p))) {
      result.cors.push(item);
    } else {
      result.headers.push(item);
    }
  }

  return result;
}

import { ISSUE_CATEGORY_PREFIXES } from "../config/scan-rules.js";
import type { IssueCategory } from "../config/scan-rules.js";

export type { IssueCategory };
export { ISSUE_CATEGORY_PREFIXES, SECTION_LABELS } from "../config/scan-rules.js";

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

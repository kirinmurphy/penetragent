import { GRADE } from "../../config/scan-rules.js";
import type { PageData } from "@penetragent/shared";

export function collectFindingsByPage(
  pages: PageData[],
): Map<string, string[]> {
  const findingsMap = new Map<string, string[]>();

  function addFinding(finding: string, pageUrl: string): void {
    if (!findingsMap.has(finding)) findingsMap.set(finding, []);
    findingsMap.get(finding)!.push(pageUrl);
  }

  for (const page of pages) {
    for (const grade of page.headerGrades) {
      if (grade.grade === GRADE.MISSING) {
        addFinding(`Missing ${grade.header} header`, page.url);
      } else if (grade.grade === GRADE.WEAK) {
        addFinding(`Weak ${grade.header}: ${grade.reason}`, page.url);
      }
    }
    for (const leak of page.infoLeakage) {
      addFinding(`${leak.header} header disclosed: ${leak.value}`, page.url);
    }
    for (const issue of page.contentIssues) {
      addFinding(issue, page.url);
    }
    for (const cookie of page.cookieIssues ?? []) {
      for (const issue of cookie.issues) {
        addFinding(issue, page.url);
      }
    }
    for (const script of page.scriptIssues ?? []) {
      for (const issue of script.issues) {
        addFinding(issue, page.url);
      }
    }
    for (const cors of page.corsIssues ?? []) {
      for (const issue of cors.issues) {
        addFinding(issue, page.url);
      }
    }
  }

  return findingsMap;
}

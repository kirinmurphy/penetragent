import type { HeaderGrade } from "@penetragent/shared";
import { GRADE, GRADE_SEVERITY } from "./scan-config.js";

export function computeWorstCaseGrades(
  pages: { headerGrades: HeaderGrade[] }[],
): { good: number; weak: number; missing: number } {
  const worstByHeader = new Map<string, string>();

  for (const page of pages) {
    for (const grade of page.headerGrades) {
      const current = worstByHeader.get(grade.header);
      if (!current || GRADE_SEVERITY[grade.grade] > GRADE_SEVERITY[current]) {
        worstByHeader.set(grade.header, grade.grade);
      }
    }
  }

  let good = 0;
  let weak = 0;
  let missing = 0;
  for (const grade of worstByHeader.values()) {
    if (grade === GRADE.GOOD) good++;
    else if (grade === GRADE.WEAK) weak++;
    else if (grade === GRADE.MISSING) missing++;
  }

  return { good, weak, missing };
}

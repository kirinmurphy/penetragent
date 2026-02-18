import type { HeaderGrade } from "@penetragent/shared";
import { GRADE_SEVERITY } from "../../config/scan-rules.js";
import { countGradeDistribution, type GradeDistribution } from "../../grading/count-grades.js";

export function computeWorstCaseGrades(
  pages: { headerGrades: HeaderGrade[] }[],
): GradeDistribution {
  const worstByHeader = new Map<string, string>();

  for (const page of pages) {
    for (const grade of page.headerGrades) {
      const current = worstByHeader.get(grade.header);
      if (!current || GRADE_SEVERITY[grade.grade] > GRADE_SEVERITY[current]) {
        worstByHeader.set(grade.header, grade.grade);
      }
    }
  }

  return countGradeDistribution(
    Array.from(worstByHeader.values()).map((grade) => ({ grade })),
  );
}

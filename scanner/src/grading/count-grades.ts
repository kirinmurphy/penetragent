import { GRADE } from "../config/scan-rules.js";

export interface GradeDistribution {
  good: number;
  weak: number;
  missing: number;
}

export function countGradeDistribution(
  items: { grade: string }[],
): GradeDistribution {
  let good = 0;
  let weak = 0;
  let missing = 0;
  for (const item of items) {
    if (item.grade === GRADE.GOOD) good++;
    else if (item.grade === GRADE.WEAK) weak++;
    else if (item.grade === GRADE.MISSING) missing++;
  }
  return { good, weak, missing };
}

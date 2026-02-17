export const GRADE = {
  GOOD: "good",
  WEAK: "weak",
  MISSING: "missing",
} as const;

export type Grade = (typeof GRADE)[keyof typeof GRADE];

export const GRADE_SEVERITY: Record<string, number> = {
  [GRADE.GOOD]: 0,
  [GRADE.WEAK]: 1,
  [GRADE.MISSING]: 2,
};

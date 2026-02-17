import { DELETION_TYPE } from "../constants.js";

export function deletionLabel(
  type: (typeof DELETION_TYPE)[keyof typeof DELETION_TYPE],
  count: number,
  identifier?: string,
): string {
  if (type === DELETION_TYPE.ALL) return "all scans";
  if (type === DELETION_TYPE.JOB) return "scan";
  return `scan${count > 1 ? "s" : ""} for ${identifier}`;
}

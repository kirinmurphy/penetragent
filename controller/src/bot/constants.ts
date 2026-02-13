export const INPUT_ALL = "all" as const;

export const COMMAND = {
  HELP: "help",
  TARGETS: "targets",
  SCANTYPES: "scantypes",
  SCAN: "scan",
  STATUS: "status",
  HISTORY: "history",
  DELETE: "delete",
  CONFIRM: "confirm",
} as const;

export const CHAT_ACTION = {
  TYPING: "typing",
} as const;

export const IDENTIFIER_TYPE = {
  JOB_ID: "jobId",
  TARGET_ID: "targetId",
  URL: "url",
  UNKNOWN: "unknown",
} as const;

export const DELETION_TYPE = {
  JOB: "job",
  TARGET: "target",
  ALL: "all",
} as const;

export function deletionLabel(
  type: (typeof DELETION_TYPE)[keyof typeof DELETION_TYPE],
  count: number,
  identifier?: string,
): string {
  if (type === DELETION_TYPE.ALL) return "all scans";
  if (type === DELETION_TYPE.JOB) return "scan";
  return `scan${count > 1 ? "s" : ""} for ${identifier}`;
}

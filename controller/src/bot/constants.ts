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

export const HISTORY_CONFIG = {
  maxJobsLimit: 1000,
  defaultRecentLimit: 100,
  groupDisplayLimit: 10,
} as const;

export const CONFIRMATION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
